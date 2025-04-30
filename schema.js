export const schema = {
    'Sin': {
        name: 'Sin',
        inputs: 1,
        outputs: 1,
        type: 'standard',
        height: 30,
        data: {
            frequency: '0'
        }
    },
    'Squ': {
        name: 'Squ',
        inputs: 1,
        outputs: 1,
        type: 'standard',
        height: 30,
        data: {
            frequency: '0'
        }
    },
    'Tri': {
        name: 'Tri',
        inputs: 1,
        outputs: 1,
        type: 'standard',
        height: 30,
        data: {
            frequency: '0'
        }
    },
    'Saw': {
        name: 'Saw',
        inputs: 1,
        outputs: 1,
        type: 'standard',
        height: 30,
        data: {
            frequency: '0'
        }
    },
    'Add': {
        name: 'Add',
        inputs: 2,
        outputs: 1,
        type: 'standard',
        height: 30,
        data: {
            frequency: '0'
        }
    },
    'Sub': {
        name: 'Sub',
        inputs: 2,
        outputs: 1,
        type: 'standard',
        height: 30,
        data: {
            frequency: '0'
        }
    },
    'Const': {
        name: 'Const',
        inputs: 0,
        outputs: 1,
        type: 'typed-integer',
        height: 50,
        data: {
            int: 'integer',
        }
    },
    'Mul': {
        name: 'Mul',
        inputs: 2,
        outputs: 1,
        type: 'standard',
        height: 30
    },
    'Div': {
        name: 'Div',
        inputs: 2,
        outputs: 1,
        type: 'standard',
        height: 30
    },
    'Midi': {
        name: 'MIDI',
        inputs: 0,
        outputs: 1,
        type: 'midi',
        height: 30,
        max: 1,
        data: {
            frequency: '0'
        }
    },
    'Fil': {
        name: 'Fil',
        inputs: 1,
        outputs: 1,
        type: 'standard',
        height: 30
    },
    'ADSR': {
        name: 'ADSR',
        inputs: 5,
        outputs: 1,
        type: 'standard',
        height: 80
    },
    'Not': {
        name: 'Notes',
        inputs: 0,
        outputs: 0,
        type: 'typed-text',
        height: 80
    },
    'Out': {
        name: 'Out',
        inputs: 1,
        outputs: 0,
        type: 'standard',
        height: 30,
        max: 1
    }
};
