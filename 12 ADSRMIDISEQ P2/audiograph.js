export class AudioGraph {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.nodes = new Map();
        this.connections = new Map();
        this.valid = true; // If the graph is valid (no cycles)
        //this.midiNote = 0;
    }

    // resets the audiograph by clearing the nodes and connections and setting to valid
    reset() {
        this.nodes.clear();
        this.connections.clear();
        this.valid = true;
    }

    /*
    setMidiNote(note) {
        this.midiNote = note;
    }
    */

    // add a node to the audiograph modules map, used by processor
    addNode(nodeId, data) {
        const { moduleId, contents } = data;

        this.nodes.set(nodeId, {
            id: nodeId,
            moduleId,
            contents,
            inputs: {},
        });
    }

    // remove a node from audiograph modules map, also used by processor
    removeNode(nodeId) {
        this.nodes.delete(nodeId);
        for (const [inputKey, outputKey] of this.connections.entries()) {
            if (inputKey.startsWith(nodeId) || outputKey.startsWith(nodeId)) {
                this.connections.delete(inputKey);
            }
        }
    }

    // add connection to map
    addConnection(fromKey, toKey) {
        this.connections.set(toKey, fromKey);
    }

    // remove connection from map
    removeConnection(fromKey, toKey) {
        if (this.connections.get(toKey) === fromKey) {
            this.connections.delete(toKey);
        }
    }

    // Adjacency list used for DFS
    buildAdjacencyList() {
        const graph = new Map();

        // Initialize
        for (const nodeId of this.nodes.keys()) {
            graph.set(nodeId, []);
        }

        // Fill
        for (const [inputKey, outputKey] of this.connections.entries()) {
            const [toNodeId] = inputKey.split('-input');
            const [fromNodeId] = outputKey.split('-output');

            if (graph.has(fromNodeId)) {
                graph.get(fromNodeId).push(toNodeId);
            }
        }

        return graph;
    }

    // DFS cycle detection
    detectCycle() {
        const graph = this.buildAdjacencyList();
        const visited = new Set();
        const recStack = new Set();

        const dfs = (nodeId) => {
            if (!visited.has(nodeId)) {
                visited.add(nodeId);
                recStack.add(nodeId);

                const neighbors = graph.get(nodeId) || [];
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor) && dfs(neighbor)) {
                        return true;
                    } else if (recStack.has(neighbor)) {
                        return true;
                    }
                }
            }

            recStack.delete(nodeId);
            return false;
        };

        for (const nodeId of graph.keys()) {
            if (dfs(nodeId)) return true;
        }

        return false;
    }

    // generates a sample for a given time interval, used by processor in batches to output the audio
    genSample(time) {
        // If graph invalid
        if (!this.valid) return 0;

        const outputNodes = [...this.nodes.values()].filter(node => node.moduleId === 'Out');
        if (outputNodes.length === 0) return 0;

        let sum = 0;
        const cache = new Map();

        for (const outNode of outputNodes) {
            const val = this.evaluateNode(outNode.id, time, cache);
            sum += val;
        }

        return sum;
    }

    // Used for recursive fetching of the results
    evaluateNode(nodeId, time, cache) {
        const cached = cache.get(nodeId);
        if (cached !== undefined) return cached;

        const node = this.nodes.get(nodeId);
        if (!node) return 0;

        const getInput = (index) => {
            const inputKey = `${nodeId}-input-${index}`;
            const fromKey = this.connections.get(inputKey);
            if (!fromKey) return 0;

            const [fromNodeId] = fromKey.split('-output');
            return this.evaluateNode(fromNodeId, time, cache);
        };

        let result = 0;

        switch (node.moduleId) {
            case 'Const':
                //console.log(node.contents)
                result = parseFloat(node.contents || '0');
                break;

            case 'Sin':
                result = Math.sin(2 * Math.PI * getInput(0) * time);
                //onsole.log(result)
                break;

            case 'Saw':
                result = 2 * (time * getInput(0) % 1) - 1;
                //onsole.log(result)
                break;

            case 'Squ':
                result = (time * getInput(0)) % 1 < 0.5 ? 1 : -1;
                //onsole.log(result)
                break;

            case 'Tri':
                result = 2 * Math.abs(2 * (time * getInput(0) % 1) - 1) - 1;
                //onsole.log(result)
                break;

            case 'Add':
                //console.log(getInput(0))
                //console.log(getInput(1))
                //console.log(result)
                result = getInput(0) + getInput(1);
                break;
            
            case 'Sub':
                result = getInput(0) - getInput(1);
                break;

            case 'Mul':
                result = getInput(0) * getInput(1);
                break;

            case 'Midi':
                //console.log(node.contents)
                result = parseFloat(node.contents || '0');
                break;

            case 'Out':
                result = getInput(0);
                break;

            default:
                result = 0;
        }

        cache.set(nodeId, result);
        return result;
    }

    // Compile graph and validate for cycle
    compileGraph(modules, connections) {
        this.reset();

        Object.entries(modules).forEach(([id, data]) => {
            this.addNode(id, data);
        });

        Object.entries(connections).forEach(([from, toList]) => {
            toList.forEach(to => {
                this.addConnection(from, to);
            });
        });

        this.valid = !this.detectCycle();

        if (!this.valid) {
            console.warn('Cycle detected in audio graph. Audio paused.');
        }
    }
}
