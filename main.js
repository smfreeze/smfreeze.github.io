import { schema } from './schema.js';
import { getQueryParam, getPortCenter } from './utility.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Declaring HTML Elements I need:
    const sidebar = document.getElementById('sidebar'); // The modules sidebar
    const indicator = document.getElementById('indicator'); // the > or < indicator on the sidebar
    const modules = document.querySelectorAll('.modules div'); // The modules in the modules div (work/editor area)
    const editorArea = document.querySelector('.editor-area'); // The actual work/editor area
    const playButton = document.getElementById('playBtn'); // Play button on top bar for suspending/resuming the audioworklet (pausing/playing sound)
    const saveButton = document.getElementById('saveBtn'); // Save button on top bar for saving projects
    const loadButton = document.getElementById('loadBtn'); // Load button on top bar for loading projects
    const fileInput = document.createElement('input');
    
    // Audioworklet and context initialisations and connections:
    const audioContext = new AudioContext();
    await audioContext.audioWorklet.addModule('processor.js');
    const workletNode = new AudioWorkletNode(audioContext, 'main-processor');
    workletNode.connect(audioContext.destination);

    // Declaring maps I need for the audiograph:
    const activeModules = new Map(); // Store which modules are on the editor area to their connector indicators to access and any other information
    const connections = new Map(); // Stores the divs of the indicators of the connections between modules

    // File input formatting for saving/loading files:
    fileInput.type = 'file';
    fileInput.accept = '.json';
    
    // Global variable declarations:
    let selectedModule = null; // Modules/node currently clicked
    let clickedConnection = null; // Module/node you click to connect to
    let nodeCounter = 0; // Counts how many module nodes are currently in the work area (for unique naming of new nodes)
    let isDragging = false; // Are you currently dragging a module (to prevent certain actions)
    let offsetX = 0 // Used when dropping modules into work area
    let offsetY = 0; // See above
    let playing = false; // Is the audio worklet active

    // Checks the query parameter, if it should load an example or not:
    const example = getQueryParam('example');
        if (example) {
            console.log("Loading ex/" + example + ".json")
            try{
                loadFromURL("ex/" + example + ".json");
                console.log("Successfully loaded")
                console.log(playing)
                await audioContext.suspend(); // For some reason it starts playing when it is loaded, suspect upon load to stop this
            } catch{
                console.log("Failed to load")
            }
        }

    // When user tries to leave page, ensure they want to:
    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
    });

    // Play button logs connections leading to audio output
    playButton.addEventListener('click', async () => {
        playPause()
        //console.log(activeModules)
        //console.log(connections)
    });

    // MIDI setup
    let midiAccess = null;
    navigator.requestMIDIAccess().then((access) => {
        midiAccess = access;
        console.log("MIDI Access granted");
        console.log(midiAccess)

        for (const input of midiAccess.inputs.values()) {
            console.log("Listening to MIDI device:", input.name);
            input.onmidimessage = handleMIDIMessage;
        }
    }).catch((err) => {
        console.error("MIDI Access error", err);
    });

    // MIDI Handler
    function handleMIDIMessage(msg) {
        try{
            const [status, note, velocity] = msg.data;
            if (velocity > 0){
                const frequency = note ? 440 * Math.pow(2, (note - 69) / 12) : 0;
        
                // Optional: Update active MIDI module(s)
                for (const [nodeId, data] of activeModules.entries()) {
                    if (data.moduleId === 'Midi') {
                        activeModules.set(nodeId, { ...data, contents: frequency });
                    }
                }
            
                drawConnections();
                generateGraph();
            }
        } catch (e) {
            console.log("Error when processing MIDI input: " + e)
        }
    }
    


    // Linking the help button to help page
    document.getElementById('helpBtn').addEventListener('click', () => {
        window.location.href = 'help.html';
    });

    // Linking the examples button to examples page
    document.getElementById('examplesBtn').addEventListener('click', () => {
        window.location.href = 'examples.html';
    });

    // Sidebar toggle, switches indicator < for > or visa versa depending on state
    indicator.addEventListener('click', () => {
        sidebar.classList.toggle('expanded');
        indicator.textContent = sidebar.classList.contains('expanded') ? '<' : '>';
    });

    // Make modules in sidebar draggable to work/editor area
    modules.forEach(module => {
        module.setAttribute('draggable', true);
        module.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', module.id);
            e.dataTransfer.effectAllowed = 'move';
        });
    });

    // Dragging over the editor
    editorArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    // If cycle is detected by processor, pause the audio and alert the user of the cycle (this will happen every time there is an action/the generateGraph() function is called, to stop the user from proceeding):
    workletNode.port.onmessage = (event) => {
        if (event.data.type === 'warning') {
            alert(event.data.message); // Output the message from the processor in processor.js using alert
        }
    };
    

    // Dropping a module in the editor+
    editorArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const moduleId = e.dataTransfer.getData('text/plain');
        if (!schema[moduleId]) return;
      
        try {
            let count = 0;
            activeModules.forEach(({ moduleId: activeModuleId }) => {
                if (activeModuleId != moduleId) {
                    // FUCK YOU FUTURE ME
                    // TODO Graying out of maxed out modules
                }
                if (activeModuleId === moduleId) {
                    count++;
                    if (count === schema[moduleId].max){
                        console.log("Hi")
                        document.getElementById(moduleId).classList.add("greyed");
                    }
                }
            });
            if (count >= schema[moduleId].max) {
                return;
            }
        } catch {}

        const moduleName = schema[moduleId].name;
        const nodeId = moduleName.replace(/\s+/g, '').toLowerCase() + '-' +`node-${nodeCounter++}`;
        const dropIndicator = document.createElement('div');
        // Heights from schema, so I can make some modules taller
        if (schema[moduleId].height) {
            dropIndicator.style.height = `${schema[moduleId].height}px`;
        } else {
            dropIndicator.style.height = '60px';
        }        
        // The note module has a different class, for formatting:
        if (schema[moduleId].type === 'typed-text') {
            dropIndicator.classList.add('module-node-note');
        }else {
            dropIndicator.classList.add('module-node');
        }
        dropIndicator.style.left = `${e.clientX - editorArea.getBoundingClientRect().left - 25}px`;
        dropIndicator.style.top = `${e.clientY - editorArea.getBoundingClientRect().top - 15}px`;
        dropIndicator.dataset.nodeId = nodeId;
    
        // Add the module name
        const moduleNameElement = document.createElement('div');
        moduleNameElement.classList.add('module-name');
        moduleNameElement.textContent = moduleName;
        dropIndicator.appendChild(moduleNameElement);
        moduleNameElement.addEventListener
        
        // This is the code for linking to the modules pages by clicking on the headers of modules
        moduleNameElement.addEventListener('click', async () => {
            window.location.href = 'modules/' + moduleName.replace(/\s+/g, '').toLowerCase() + '.html';
        });

        moduleNameElement.addEventListener('mouseenter', () => {
            moduleNameElement.textContent = '?'.repeat(moduleName.length);
            moduleNameElement.style.cursor = 'pointer';
        });
        
        moduleNameElement.addEventListener('mouseleave', () => {
            moduleNameElement.textContent = moduleName;
        });

        // Input box adding for modules of class 'typed', like const nodes, they have their own css to account for certain things like typing and width
        if (schema[moduleId].type === 'typed-integer') {
            const inputBoxContainer = document.createElement('div');
            inputBoxContainer.classList.add('input-box-container');
    
            const inputBox = document.createElement('input');
            inputBox.type = 'number';
            inputBox.placeholder = '';
            inputBox.classList.add('module-input');
            inputBoxContainer.appendChild(inputBox);

            const contents = inputBox.value; // Initial content (empty at first)
            activeModules.set(nodeId, { moduleId, dropIndicator, contents });

            inputBox.addEventListener('input', function () {
                this.style.height = 'auto'; // Reset height
                this.style.height = (this.scrollHeight) + 'px'; // Expand based on content
        
                // Update textContent when the user types
                const contents = this.value;
        
                // Update the activeModules map with the new content
                activeModules.set(nodeId, { moduleId, dropIndicator, contents });

                drawConnections();
                generateGraph();
            });
            
            dropIndicator.appendChild(inputBoxContainer);
        }
        // For the notes, or modules with 'typed-text' type, they have their own css to account for certain things like typing and width
        if (schema[moduleId].type === 'typed-text') {
            const inputBoxContainer = document.createElement('div');
            inputBoxContainer.classList.add('input-box-container');
        
            const inputBox = document.createElement('textarea'); // Change input to textarea
            inputBox.placeholder = 'Enter notes...';
            inputBox.classList.add('module-notes');
            inputBox.rows = 1; // Start small
            inputBox.style.overflow = 'hidden'; // Hide scroll initially
            inputBox.style.resize = 'none'; // Prevent manual resizing
        
            // Initialize the module in the activeModules map before any input is made
            const contents = inputBox.value; // Initial content (empty at first)
            activeModules.set(nodeId, { moduleId, dropIndicator, contents });
        
            // Auto-expand functionality as well as saving state of notes to activeModules for saving/loading
            inputBox.addEventListener('input', function () {
                this.style.height = 'auto'; // Reset height
                this.style.height = (this.scrollHeight) + 'px'; // Expand based on content
        
                // Update textContent when the user types
                const contents = this.value;
        
                // Update the activeModules map with the new content
                activeModules.set(nodeId, { moduleId, dropIndicator, contents });

                drawConnections();
                generateGraph();
            });
        
            inputBoxContainer.appendChild(inputBox);
            dropIndicator.appendChild(inputBoxContainer);
        }
        else{
            activeModules.set(nodeId, { moduleId, dropIndicator });
        }
    
        // Create input and output nodes dynamically
        createIOPorts(dropIndicator, nodeId, moduleId);
        addDraggingFunctionality(dropIndicator);
        editorArea.appendChild(dropIndicator);

        drawConnections();
        generateGraph();
    });
    
    function drawConnections() {
        const svg = document.getElementById('connection-lines');
        try{
            // clear the svg element in index.html to redraw the paths.
            svg.innerHTML = '';
        } catch {
            console.log("nothing to clear")
        }
    
        connections.forEach((inputs, outputId) => {
            // clear all existing 
            const outputEl = document.getElementById(outputId);
            if (!outputEl) return;
    
            const outputPos = getPortCenter(outputEl);
    
            // for each connection, find the ports centers and draw the bezier curve between them
            inputs.forEach(inputId => {
                const inputEl = document.getElementById(inputId);
                if (!inputEl) return;
    
                // get the position of the center of the given port
                const inputPos = getPortCenter(inputEl);
    
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute('stroke', '#888');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                // Bezier curve function for a nice smooth looking curve
                path.setAttribute('d', `M ${outputPos.x},${outputPos.y} C ${outputPos.x + 50},${outputPos.y} ${inputPos.x - 50},${inputPos.y} ${inputPos.x},${inputPos.y}`);
    
                // add the curve to the svg
                svg.appendChild(path);
            });
        });
    }

    window.addEventListener('resize', drawConnections);
    window.addEventListener('scroll', drawConnections);

    
    // Function that creates the input and output ports of the modules once you have dragged and dropped them
    function createIOPorts(dropIndicator, nodeId, moduleId) {
        if (schema[moduleId].inputs > 0) {
            // Figure out the spacing between the input ports, it does this by using the height attribute of each module as stored in the schema
            const nodeHeight = parseInt(dropIndicator.style.height) || 60;
            const inputSpacing = nodeHeight / (schema[moduleId].inputs + 1);
            for (let i = 0; i < schema[moduleId].inputs; i++) {
                // The indicator HTML/CSS
                const inputNode = document.createElement('div');
                inputNode.classList.add('input-node');
                inputNode.id = nodeId + "-input-" + i;
                inputNode.style.top = `${inputSpacing * (i + 1)}px`;
                dropIndicator.appendChild(inputNode);
    
                inputNode.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleConnection(nodeId, inputNode);
                });
            }
        }
        
        // Repeat for output ports
        if (schema[moduleId].outputs > 0) {
            // Figure out the spacing between the output ports, it does this by using the height attribute of each module as stored in the schema
            const nodeHeight = parseInt(dropIndicator.style.height) || 60;
            const outputSpacing = nodeHeight / (schema[moduleId].outputs + 1);
            for (let i = 0; i < schema[moduleId].outputs; i++) {
                // The indicator HTML/CSS
                const outputNode = document.createElement('div');
                outputNode.classList.add('output-node');
                outputNode.id = nodeId + "-output-" + i;
                outputNode.style.top = `${outputSpacing * (i + 1)}px`;
                dropIndicator.appendChild(outputNode);
    
                outputNode.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectOutput(nodeId, outputNode);
                });
            }
        }
    }
    
    // Function that handles the connection between two modules ports, deals with many edge cases and the visual changes of the indicators.
    function handleConnection(nodeId, inputNode) {
        if (clickedConnection) {
            const outputNodeId = clickedConnection.split("-").slice(0, 3).join("-");
            const inputNodeId = inputNode.id.split("-").slice(0, 3).join("-");
    
            // Prevent connecting a node's output to its own input
            if (outputNodeId === inputNodeId) {
                console.log("Cannot connect a node to itself.");
                return;
            }
    
            // Disconnect inputNode from any existing output
            for (const [output, inputs] of connections.entries()) {
                const inputIndex = inputs.indexOf(inputNode.id);
                if (inputIndex !== -1) {
                    inputs.splice(inputIndex, 1);
                    console.log(`Disconnected ${inputNode.id} from ${output}`);
    
                    // If output has no more inputs, remove the connection entry and visual class
                    if (inputs.length === 0) {
                        connections.delete(output);
                        document.getElementById(output)?.classList.remove('clicked');
                    }
                }
            }
    
            // Add new connection from clicked output to input
            if (connections.has(clickedConnection)) {
                connections.get(clickedConnection).push(inputNode.id);
            } else {
                connections.set(clickedConnection, [inputNode.id]);
            }
    
            // Re-check if clickedConnection still has any inputs, otherwise remove visual class
            const inputsForClicked = connections.get(clickedConnection);
            if (!inputsForClicked || inputsForClicked.length === 0) {
                document.getElementById(clickedConnection)?.classList.remove('clicked');
            } else {
                document.getElementById(clickedConnection)?.classList.add('clicked');
            }
    
            // Mark input as clicked
            inputNode.classList.add('clicked');
    
            clickedConnection = null;
    
            drawConnections();
            generateGraph();
        }
    }
    
    
    
    // Function called when you select the output of a module
    function selectOutput(nodeId, outputNode) {
        const outputId = outputNode.id;
    
        if (clickedConnection === outputId) {
            console.log(`Deselected output ${outputId}`);
    
            const prevInputIds = connections.get(clickedConnection);
    
            prevInputIds?.forEach(inputId => {
                document.getElementById(inputId)?.classList.remove('clicked');
            });
    
            outputNode.classList.remove('clicked');
            connections.delete(clickedConnection);
    
            clickedConnection = null; // Reset connection state
    
            drawConnections();
            generateGraph();
    
            return;
        }
    
        if (clickedConnection !== null) {
            const prevOutputNode = document.getElementById(clickedConnection);
            const prevInputId = connections.get(clickedConnection);
    
            prevOutputNode?.classList.remove('clicked');
            document.getElementById(prevInputId)?.classList.remove('clicked');
        }
    
        clickedConnection = outputId;
        console.log(`Selected output ${outputId}`);
        outputNode.classList.add('clicked');
    
        drawConnections();
        generateGraph();
    }

    // Function for deleting of a node, deals with the connections mappings, active modules and visual connections
    function deleteNode(nodeId) {
        if (!activeModules.has(nodeId)) return;
    
        // Remove the visual node element
        const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeElement) {
            nodeElement.remove();
        }
    
        const toRemove = [];
    
        // Loop over all connections
        connections.forEach((inputs, output) => {
            const newInputs = inputs.filter(inputId => {
                const inputNodeBelongsToDeleted = inputId.startsWith(nodeId);
                if (inputNodeBelongsToDeleted) {
                    // Remove clicked state from input
                    document.getElementById(inputId)?.classList.remove('clicked');
                }
                return !inputNodeBelongsToDeleted;
            });
    
            const outputBelongsToDeleted = output.startsWith(nodeId);
    
            if (outputBelongsToDeleted) {
                // Output node is part of the deleted node
                document.getElementById(output)?.classList.remove('clicked');
                inputs.forEach(inputId => {
                    document.getElementById(inputId)?.classList.remove('clicked');
                });
                toRemove.push(output);
            } else if (newInputs.length !== inputs.length) {
                // Inputs were removed due to deletion
                if (newInputs.length === 0) {
                    document.getElementById(output)?.classList.remove('clicked');
                    toRemove.push(output);
                } else {
                    connections.set(output, newInputs);
                }
            }
        });
    
        // Remove marked connections
        toRemove.forEach(output => connections.delete(output));
    
        // Also, if the node being deleted is currently selected as an output
        if (clickedConnection && clickedConnection.startsWith(nodeId)) {
            clickedConnection = null;
        }
    
        // Remove from activeModules
        activeModules.delete(nodeId);

        drawConnections();
        generateGraph();

    }

    // function for dragging the modules onced theyh have been placed in the work area
    function addDraggingFunctionality(dropIndicator) {
        dropIndicator.addEventListener('mousedown', (e) => {
            isDragging = true;
            selectedModule = dropIndicator;
            offsetX = e.clientX - dropIndicator.getBoundingClientRect().left;
            offsetY = e.clientY - dropIndicator.getBoundingClientRect().top;

            document.querySelectorAll('.module-node').forEach(node => node.classList.remove('selected'));
            dropIndicator.classList.add('selected');
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging && selectedModule) {
                selectedModule.style.left = `${e.clientX - editorArea.getBoundingClientRect().left - offsetX}px`;
                selectedModule.style.top = `${e.clientY - editorArea.getBoundingClientRect().top - offsetY}px`;
                drawConnections();
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            drawConnections();

        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && selectedModule) {
                deleteNode(selectedModule.dataset.nodeId);
                selectedModule = null;
                drawConnections();
            }
        });
    }

    // To be called whenever a change is made to the graph so the processor can figure out what has changes and update the audiograph
    function generateGraph() {
        console.log(activeModules)
        //console.log(connections)


        // Clear previous graph
        workletNode.port.postMessage({ command: 'reset' });
    
        // Convert connections map to plain object
        const serializedConnections = {};
        connections.forEach((inputs, output) => {
            serializedConnections[output] = inputs;
        });
    
        // Convert activeModules map to plain object
        const serializedModules = {};
        activeModules.forEach((data, nodeId) => {
            // You might want to exclude non-serializable stuff like DOM elements
            const { dropIndicator, ...safeData } = data;
            serializedModules[nodeId] = safeData;
        });
    
        // Push the serialized graph
        workletNode.port.postMessage({
            command: 'pushGraph',
            args: {
                activeModules: serializedModules,
                connections: serializedConnections
            }
        });
    }

    // Asynchronous function to pause/play the audio in the processor.js using suspent and resume functions of web audio API
    async function playPause() {
        if (audioContext.state === 'suspended' && playing === false) {
            await audioContext.resume();
            playing = true;
            playButton.textContent = "Stop"; // Change text to "Stop"
        } else {
            await audioContext.suspend();
            playing = false;
            playButton.textContent = "Play"; // Change text back to "Play"
        }
    
        //console.log('Active Modules:', Array.from(activeModules.keys()));
        //console.log('Connections:', Array.from(connections.entries()));
        generateGraph();
    }

    // function that checks if a local file URL is valid so I can use it in the project (some weird javascript stuff)
    function loadFromURL(fileUrl) {
        fetch(fileUrl)
            .then(res => {
                if (!res.ok) throw new Error('Network error');
                return res.blob(); // Create a File-like object from blob
            })
            .then(blob => {
                const fakeFile = new File([blob], "example.json", { type: "application/json" });
                loadFile(fakeFile);
            })
            .catch(err => {
                alert("Failed to load example file.");
                console.error(err);
            });
    }

    // Save project state to a downloadable file
    saveButton.addEventListener('click', () => {
        const projectData = {
            modules: Array.from(activeModules.entries()).map(([nodeId, { moduleId, dropIndicator, contents }]) => ({
                nodeId,
                moduleId,
                position: {
                    left: dropIndicator.style.left,
                    top: dropIndicator.style.top
                },
                contents: contents || '' // <-- Save contents (empty string fallback)
            })),
            connections: Array.from(connections.entries()),
        };
    
        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'audio_project.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    

    

    // Load project state from a file
loadButton.addEventListener('click', () => fileInput.click()); // Open file dialog when load button is clicked

// File picker for loading files
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) loadFile(file);
});

// Function to load a project JSON file into the program
function loadFile(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const projectData = JSON.parse(event.target.result);

        // Clear current modules and connections
        activeModules.clear();
        connections.clear();
        editorArea.innerHTML = ''; // Clear the editor

        // Ensure the SVG element is created
        let svg = document.getElementById('connection-lines');
        if (!svg) {
            svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.id = 'connection-lines';
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '0';
            document.body.appendChild(svg); // Append to the body or your desired container
        }

        // Recreate modules
        projectData.modules.forEach(({ nodeId, moduleId, position, contents }) => {
            const dropIndicator = document.createElement('div');
            // Set up dropIndicator styling, classes, etc, similar to your drop code
            if (schema[moduleId].height) {
                dropIndicator.style.height = `${schema[moduleId].height}px`;
            } else {
                dropIndicator.style.height = '60px';
            }
            if (schema[moduleId].type === 'typed-text') {
                dropIndicator.classList.add('module-node-note');
            } else {
                dropIndicator.classList.add('module-node');
            }
            dropIndicator.style.left = position.left;
            dropIndicator.style.top = position.top;
            dropIndicator.dataset.nodeId = nodeId;

            const moduleNameElement = document.createElement('div');
            moduleNameElement.classList.add('module-name');
            moduleNameElement.textContent = schema[moduleId].name;
            dropIndicator.appendChild(moduleNameElement);

            // Reconnect header click behaviour
            moduleNameElement.addEventListener('click', async () => {
                window.location.href = 'modules/' + schema[moduleId].name.replace(/\s+/g, '').toLowerCase() + '.html';
            });
            moduleNameElement.addEventListener('mouseenter', () => {
                moduleNameElement.textContent = '?'.repeat(schema[moduleId].name.length);
                moduleNameElement.style.cursor = 'pointer';
            });
            moduleNameElement.addEventListener('mouseleave', () => {
                moduleNameElement.textContent = schema[moduleId].name;
            });

            // Handle inputs (for typed-integer, typed-text, etc.)
            if (schema[moduleId].type === 'typed-integer') {
                const inputBoxContainer = document.createElement('div');
                inputBoxContainer.classList.add('input-box-container');

                const inputBox = document.createElement('input');
                inputBox.type = 'number';
                inputBox.placeholder = '';
                inputBox.classList.add('module-input');
                inputBox.value = contents || ''; // Load the saved contents (if any)
                inputBoxContainer.appendChild(inputBox);

                inputBox.addEventListener('input', function () {
                    const contents = this.value;
                    activeModules.set(nodeId, { moduleId, dropIndicator, contents });
                    drawConnections();
                    generateGraph();
                });

                activeModules.set(nodeId, { moduleId, dropIndicator, contents });
                drawConnections();
                generateGraph();

                dropIndicator.appendChild(inputBoxContainer);
            } else if (schema[moduleId].type === 'typed-text') {
                const inputBoxContainer = document.createElement('div');
                inputBoxContainer.classList.add('input-box-container');

                const inputBox = document.createElement('textarea');
                inputBox.placeholder = 'Enter notes...';
                inputBox.classList.add('module-notes');
                inputBox.rows = 1;
                inputBox.value = contents || ''; // Load the saved contents (if any)
                inputBox.style.overflow = 'hidden';
                inputBox.style.resize = 'none';

                inputBox.addEventListener('input', function () {
                    const contents = this.value;
                    activeModules.set(nodeId, { moduleId, dropIndicator, contents });
                    drawConnections();
                    generateGraph();
                });

                activeModules.set(nodeId, { moduleId, dropIndicator, contents });
                drawConnections();
                generateGraph();

                inputBoxContainer.appendChild(inputBox);
                dropIndicator.appendChild(inputBoxContainer);
            } else {
                activeModules.set(nodeId, { moduleId, dropIndicator });
            }

            // Create I/O ports and add dragging functionality
            createIOPorts(dropIndicator, nodeId, moduleId);
            addDraggingFunctionality(dropIndicator);
            editorArea.appendChild(dropIndicator);
        });

        // Recreate connections
        connections.clear();
        projectData.connections.forEach(([outputId, inputIds]) => {
            connections.set(outputId, inputIds);

            // Update the visual state of output and input ports after restoring connections
            inputIds.forEach(inputId => {
                const inputNode = document.getElementById(inputId);
                if (inputNode) {
                    inputNode.classList.add('clicked'); // Mark the input port as connected
                }
            });

            const outputNode = document.getElementById(outputId);
            if (outputNode) {
                outputNode.classList.add('clicked'); // Mark the output port as connected
            }
        });

        // After everything is done
        drawConnections(); // Now that everything is in the DOM, we can draw connections
        generateGraph();   // If needed, rebuild any graph-related visuals
    };

    reader.readAsText(file);
}




});