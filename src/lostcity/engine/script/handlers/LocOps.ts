import ParamType from '#lostcity/cache/ParamType.js';
import LocType from '#lostcity/cache/LocType.js';
import { ParamHelper } from '#lostcity/cache/ParamHelper.js';

import World from '#lostcity/engine/World.js';

import ScriptOpcode from '#lostcity/engine/script/ScriptOpcode.js';
import ScriptPointer, { checkedHandler } from '#lostcity/engine/script/ScriptPointer.js';
import { CommandHandlers } from '#lostcity/engine/script/ScriptRunner.js';

import Loc from '#lostcity/entity/Loc.js';
import { Position } from '#lostcity/entity/Position.js';

const ActiveLoc = [ScriptPointer.ActiveLoc, ScriptPointer.ActiveLoc2];

const LocOps: CommandHandlers = {
    [ScriptOpcode.LOC_ADD]: (state) => {
        const [coord, type, angle, shape, duration] = state.popInts(5);

        if (type == -1) {
            throw new Error('LOC_ADD attempted to use loc was null.');
        }

        if (duration < 1) {
            throw new Error(`LOC_ADD attempted to use duration that was out of range: ${duration}. duration should be greater than zero.`);
        }

        if (coord < 0 || coord > Position.max) {
            throw new Error(`LOC_ADD attempted to use coord that was out of range: ${coord}. Range should be: 0 to ${Position.max}`);
        }

        if (angle < 0 || angle > 3) {
            throw new Error(`LOC_ADD attempted to use angle that was out of range: ${angle}. Range should be: 0 to 3`);
        }

        if (shape < 0 || shape > 0x1F) {
            throw new Error(`LOC_ADD attempted to use shape that was out of range: ${shape}. Range should be: 0 to 31`);
        }

        const pos = Position.unpackCoord(coord);

        const locType = LocType.get(type);
        const loc = new Loc(
            pos.level,
            pos.x,
            pos.z,
            locType.width,
            locType.length,
            type,
            shape,
            angle
        );

        World.addLoc(loc, duration);
        state.activeLoc = loc;
        state.pointerAdd(ActiveLoc[state.intOperand]);
    },

    [ScriptOpcode.LOC_ANGLE]: checkedHandler(ActiveLoc, (state) => {
        state.pushInt(state.activeLoc.angle);
    }),

    [ScriptOpcode.LOC_ANIM]: checkedHandler(ActiveLoc, (state) => {
        const seq = state.popInt();

        const loc = state.activeLoc;
        World.getZone(loc.x, loc.z, loc.level).animLoc(loc, seq);
    }),

    [ScriptOpcode.LOC_CATEGORY]: checkedHandler(ActiveLoc, (state) => {
        const loc = LocType.get(state.activeLoc.type);
        state.pushInt(loc.category);
    }),

    [ScriptOpcode.LOC_CHANGE]: checkedHandler(ActiveLoc, (state) => {
        throw new Error('unimplemented');
    }),

    [ScriptOpcode.LOC_COORD]: checkedHandler(ActiveLoc, (state) => {
        const loc = state.activeLoc;
        state.pushInt(Position.packCoord(loc.level, loc.x, loc.z));
    }),

    [ScriptOpcode.LOC_DEL]: checkedHandler(ActiveLoc, (state) => {
        const duration = state.popInt();

        if (duration < 1) {
            throw new Error(`LOC_DEL attempted to use duration that was out of range: ${duration}. duration should be greater than zero.`);
        }

        World.removeLoc(state.activeLoc, duration);
    }),

    [ScriptOpcode.LOC_FIND]: (state) => {
        const [ coord, locId ] = state.popInts(2);

        if (coord < 0 || coord > Position.max) {
            throw new Error(`LOC_FIND attempted to use coord that was out of range: ${coord}. Range should be: 0 to ${Position.max}`);
        }

        const pos = Position.unpackCoord(coord);

        const loc = World.getLoc(pos.x, pos.z, pos.level, locId);
        if (!loc) {
            state.pushInt(0);
            return;
        }

        const locType = LocType.get(locId);

        state.pushInt(locType.active);
    },

    [ScriptOpcode.LOC_FINDALLZONE]: (state) => {
        const coord = state.popInt();

        if (coord < 0 || coord > Position.max) {
            throw new Error(`LOC_FINDALLZONE attempted to use coord that was out of range: ${coord}. Range should be: 0 to ${Position.max}`);
        }

        const pos = Position.unpackCoord(coord);

        state.locFindAllZone = World.getZoneLocs(pos.x, pos.z, pos.level);
        state.locFindAllZoneIndex = 0;

        // not necessary but if we want to refer to the original loc again, we can
        if (state._activeLoc) {
            state._activeLoc2 = state._activeLoc;
            state.pointerAdd(ScriptPointer.ActiveLoc2);
        }
    },

    [ScriptOpcode.LOC_FINDNEXT]: (state) => {
        const loc = state.locFindAllZone[state.locFindAllZoneIndex++];

        if (loc) {
            state._activeLoc = loc;
            state.pointerAdd(ScriptPointer.ActiveLoc);
        }

        state.pushInt(loc ? 1 : 0);
    },

    [ScriptOpcode.LOC_PARAM]: checkedHandler(ActiveLoc, (state) => {
        const paramId = state.popInt();
        const param = ParamType.get(paramId);
        const loc = LocType.get(state.activeLoc.type);
        if (param.isString()) {
            state.pushString(ParamHelper.getStringParam(paramId, loc, param.defaultString));
        } else {
            state.pushInt(ParamHelper.getIntParam(paramId, loc, param.defaultInt));
        }
    }),

    [ScriptOpcode.LOC_TYPE]: checkedHandler(ActiveLoc, (state) => {
        state.pushInt(state.activeLoc.type);
    }),

    [ScriptOpcode.LOC_NAME]: checkedHandler(ActiveLoc, (state) => {
        const loc = LocType.get(state.activeLoc.type);
        
        state.pushString(loc.name ?? 'null');
    }),

    [ScriptOpcode.LOC_SHAPE]: checkedHandler(ActiveLoc, (state) => {
        state.pushInt(state.activeLoc.shape);
    }),
};

export default LocOps;
