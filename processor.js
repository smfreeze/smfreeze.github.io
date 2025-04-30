import { AudioGraph } from './audiograph.js';

class MainProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.audioGraph = new AudioGraph(sampleRate); // Initialise Audiograph
        this.time = 0; // Keep track of time for certain modules
        this.prevModules = {}; // list of modules to compare to the new ones to be passed in to figure out what changes and adjust the audiograph from that
        this.prevConnections = {}; // similar to above but connections between modules
        this.currentMidiNote = null; // The midi note

        // message handler:
        this.port.onmessage = (event) => {
            const { command, args, type, note } = event.data;

            // reset graph command
            if (command === 'reset') {
                this.audioGraph.reset();
                this.prevModules = {};
                this.prevConnections = {};
            }

            if (command === 'pushGraph') {
                // Sets two variables for the passed in active modules and connections maps for use later
                const newModules = args.activeModules;
                const newConnections = args.connections;

                // Find out which modules have been removed and added using key mappings:
                const addedModules = [];
                const removedModules = [];

                Object.keys(this.prevModules).forEach(id => {
                    if (!(id in newModules)) removedModules.push(id);
                });

                Object.keys(newModules).forEach(id => {
                    if (!(id in this.prevModules)) {
                        addedModules.push({ id, data: newModules[id] });
                    }
                });

                // Then for each removed and added module, update the audiograph
                removedModules.forEach(id => this.audioGraph.removeNode(id));
                addedModules.forEach(({ id, data }) => this.audioGraph.addNode(id, data));

                // convert connactions map to flattened version
                const flatten = obj =>
                    Object.entries(obj).flatMap(([from, toList]) =>
                        toList.map(to => [from, to])
                    );

                    // then take the flattened version and turn it into set for set comparisons
                const prevConnSet = new Set(flatten(this.prevConnections).map(JSON.stringify));
                const newConnSet = new Set(flatten(newConnections).map(JSON.stringify));

                // set comparisons for easy change detections:
                const removedConnections = [...prevConnSet]
                    .filter(conn => !newConnSet.has(conn))
                    .map(JSON.parse);
                const addedConnections = [...newConnSet]
                    .filter(conn => !prevConnSet.has(conn))
                    .map(JSON.parse);

                // Update audiograph with connection changes
                removedConnections.forEach(([from, to]) => this.audioGraph.removeConnection(from, to));
                addedConnections.forEach(([from, to]) => this.audioGraph.addConnection(from, to));

                // set the prev maps to new ones for next time graph is pushed
                this.prevModules = newModules;
                this.prevConnections = newConnections;

                // Check for cycles after graph changes
                const hasCycle = this.audioGraph.detectCycle();

                // Variable used in the process() function to figure out if processing should continue (it shouldn't if there is a cycle)
                this.audioGraph.valid = !hasCycle;

                // if there is a cycle, send warning to main thread (main.js) so it can alert
                if (hasCycle) {
                    this.port.postMessage({
                        type: 'warning',
                        message: 'Cycle detected, please address this before continuing.'
                    });
                }
            }
        };
    }

    process(_, outputs) {
        // Don't process audio while graph is invalid
        if (!this.audioGraph.valid) {
            return true;
        }

        // Otherwise, generate batch of samples at sample rate (44100) from audiograph and output to create the sound:
        const output = outputs[0];
        const sampleDuration = 1 / this.audioGraph.sampleRate;

        for (let i = 0; i < output[0].length; i++) {
            const sample = this.audioGraph.genSample(this.time); // through evaluateNode
            for (let channel = 0; channel < output.length; channel++) {
                output[channel][i] = sample;
            }
            this.time += sampleDuration;
        }

        return true;
    }
}

registerProcessor('main-processor', MainProcessor);
