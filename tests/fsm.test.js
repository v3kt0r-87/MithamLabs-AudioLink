import test from 'node:test';
import assert from 'node:assert/strict';
import { CallState, CallStateMachine } from '../js/fsm.js';

test('FSM starts in STANDBY state', () => {
    const fsm = new CallStateMachine();
    assert.equal(fsm.state, CallState.STANDBY);
});

test('FSM allows valid transitions', () => {
    const fsm = new CallStateMachine();

    assert.equal(fsm.transition(CallState.INITIALIZING), true);
    assert.equal(fsm.state, CallState.INITIALIZING);

    assert.equal(fsm.transition(CallState.LOBBY), true);
    assert.equal(fsm.state, CallState.LOBBY);

    assert.equal(fsm.transition(CallState.CALLING_OUT), true);
    assert.equal(fsm.state, CallState.CALLING_OUT);

    assert.equal(fsm.transition(CallState.CONNECTED), true);
    assert.equal(fsm.state, CallState.CONNECTED);

    assert.equal(fsm.transition(CallState.TERMINATING), true);
    assert.equal(fsm.state, CallState.TERMINATING);

    assert.equal(fsm.transition(CallState.LOBBY), true);
    assert.equal(fsm.state, CallState.LOBBY);
});

test('FSM blocks invalid transitions', () => {
    const fsm = new CallStateMachine();
    // Cannot jump from STANDBY directly to CONNECTED
    assert.equal(fsm.can(CallState.CONNECTED), false);
    assert.equal(fsm.transition(CallState.CONNECTED), false);
    assert.equal(fsm.state, CallState.STANDBY);

    fsm.forceState(CallState.LOBBY);
    // Cannot jump from LOBBY directly to CONNECTING without call initiation
    assert.equal(fsm.can(CallState.CONNECTING), false);
    assert.equal(fsm.transition(CallState.CONNECTING), false);
    assert.equal(fsm.state, CallState.LOBBY);
});

test('FSM emits change events with payload', () => {
    const fsm = new CallStateMachine();
    let changeEvent = null;

    fsm.on('change', (evt) => {
        changeEvent = evt;
    });

    fsm.transition(CallState.INITIALIZING, { testKey: '123' });
    assert.deepEqual(changeEvent, {
        current: CallState.INITIALIZING,
        previous: CallState.STANDBY,
        payload: { testKey: '123' }
    });
});

test('FSM forceState bypasses transition guards when required', () => {
    const fsm = new CallStateMachine();
    fsm.forceState(CallState.LOBBY, { reset: true });
    assert.equal(fsm.state, CallState.LOBBY);
});
