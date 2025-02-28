import Packet from '#jagex2/io/Packet.js';
import Loc from '#lostcity/entity/Loc.js';
import Npc from '#lostcity/entity/Npc.js';
import Obj from '#lostcity/entity/Obj.js';
import Player from '#lostcity/entity/Player.js';
import { ServerProt } from '#lostcity/server/ServerProt.js';
import World from '#lostcity/engine/World.js';
import { LocShapes } from '#lostcity/engine/collision/LocShape.js';

class ZoneEvent {
    type = -1;
    receiverId = -1;
    buffer: Packet = new Packet();
    tick = -1;
    static = false;

    // temp
    x = -1;
    z = -1;

    // loc
    layer = -1;

    constructor(type: number) {
        this.type = type;
    }
}

export default class Zone {
    static mapAnim(srcX: number, srcZ: number, id: number, height: number, delay: number) {
        const out = new Packet();
        out.p1(ServerProt.MAP_ANIM);

        out.p1(((srcX & 0x7) << 4) | (srcZ & 0x7));
        out.p2(id);
        out.p1(height + 100);
        out.p2(delay);

        return out;
    }

    // variables fully broken out for now
    //coord $from, coord $to, spotanim $spotanim, int $fromHeight, int $toHeight, int $startDelay, int $endDelay, int $peak, int $arc
    static mapProjAnim(srcX: number, srcZ: number,
        dstX: number, dstZ: number,
        target: number, spotanim: number,
        srcHeight: number, dstHeight: number,
        startDelay: number, endDelay: number,
        peak: number, arc: number)
    {
        const out = new Packet();
        out.p1(ServerProt.MAP_PROJANIM);

        out.p1(((srcX & 0x7) << 4) | (srcZ & 0x7));
        out.p1(dstX - srcX);
        out.p1(dstZ - srcZ);
        out.p2(target); // 0: coord, > 0: npc, < 0: player
        out.p2(spotanim);
        out.p1(srcHeight + 100);
        out.p1(dstHeight + 100);
        out.p2(startDelay);
        out.p2(endDelay);
        out.p1(peak);
        out.p1(arc);

        return out;
    }

    static locAddChange(srcX: number, srcZ: number, id: number, shape: number, angle: number) {
        const out = new Packet();
        out.p1(ServerProt.LOC_ADD_CHANGE);

        out.p1(((srcX & 0x7) << 4) | (srcZ & 0x7));
        out.p1((shape << 2) | (angle & 3));
        out.p2(id);

        return out;
    }

    static locDel(srcX: number, srcZ: number, shape: number, angle: number) {
        const out = new Packet();
        out.p1(ServerProt.LOC_DEL);

        out.p1(((srcX & 0x7) << 4) | (srcZ & 0x7));
        out.p1((shape << 2) | (angle & 3));

        return out;
    }

    // merge player with loc, e.g. agility training through pipes
    // useful due to draw prioritizes
    static locMerge(srcX: number, srcZ: number,
        shape: number, angle: number, locId: number,
        startCycle: number, endCycle: number,
        pid: number, east: number, south: number, west: number, north: number)
    {
        const out = new Packet();
        out.p1(ServerProt.LOC_MERGE);

        out.p1(((srcX & 0x7) << 4) | (srcZ & 0x7));
        out.p1((shape << 2) | (angle & 3));
        out.p2(locId);
        out.p2(startCycle);
        out.p2(endCycle);
        out.p2(pid);
        out.p1(east - srcX);
        out.p1(south - srcZ);
        out.p1(west - srcX);
        out.p1(north - srcZ);

        return out;
    }

    static locAnim(srcX: number, srcZ: number, shape: number, angle: number, id: number) {
        const out = new Packet();
        out.p1(ServerProt.LOC_ANIM);

        out.p1(((srcX & 0x7) << 4) | (srcZ & 0x7));
        out.p1((shape << 2) | (angle & 3));
        out.p2(id);

        return out;
    }

    static objAdd(srcX: number, srcZ: number, id: number, count: number) {
        const out = new Packet();
        out.p1(ServerProt.OBJ_ADD);

        out.p1(((srcX & 0x7) << 4) | (srcZ & 0x7));
        out.p2(id);

        if (count > 65535) {
            count = 65535;
        }
        out.p2(count);

        return out;
    }

    static objCount(srcX: number, srcZ: number, id: number, count: number) {
        const out = new Packet();
        out.p1(ServerProt.OBJ_COUNT);

        out.p1(((srcX & 0x7) << 4) | (srcZ & 0x7));
        out.p2(id);

        if (count > 65535) {
            count = 65535;
        }
        out.p2(count);

        return out;
    }

    static objDel(srcX: number, srcZ: number, id: number, count: number) {
        const out = new Packet();
        out.p1(ServerProt.OBJ_DEL);

        out.p1(((srcX & 0x7) << 4) | (srcZ & 0x7));
        out.p2(id);

        return out;
    }

    static objReveal(srcX: number, srcZ: number, id: number, count: number, receiverId: number) {
        const out = new Packet();
        out.p1(ServerProt.OBJ_REVEAL);

        out.p1(((srcX & 0x7) << 4) | (srcZ & 0x7));
        out.p2(id);
        out.p2(count);
        out.p2(receiverId);

        return out;
    }

    index = -1; // packed coord

    // zone entities
    players: Player[] = []; // tracked here to get players in a zone
    npcs: Npc[] = []; // tracked here to get npcs in a zone
    staticLocs: Loc[] = []; // source of truth from map data
    locs: Loc[] = []; // dynamic locs
    staticObjs: Obj[] = []; // source of truth from server map data
    objs: Obj[] = []; // dynamic objs

    // zone events
    updates: ZoneEvent[] = [];
    lastEvent = -1;
    buffer: Packet = new Packet();

    constructor(index: number) {
        this.index = index;
    }

    // ---- not tied to any entities ----

    animMap(x: number, z: number, spotanim: number, height: number, delay: number) {
        const event = new ZoneEvent(ServerProt.MAP_ANIM);

        event.buffer = Zone.mapAnim(x, z, spotanim, height, delay);
        event.x = x;
        event.z = z;
        event.tick = World.currentTick;

        this.updates.push(event);
        this.lastEvent = World.currentTick;
    }

    mapProjAnim(x: number, z: number,
        dstX: number, dstZ: number,
        target: number, spotanim: number,
        srcHeight: number, dstHeight: number,
        startDelay: number, endDelay: number,
        peak: number, arc: number)
    {
        const event = new ZoneEvent(ServerProt.MAP_PROJANIM);

        event.buffer = Zone.mapProjAnim(x, z, dstX, dstZ, target, spotanim, srcHeight, dstHeight, startDelay, endDelay, peak, arc);
        event.x = x;
        event.z = z;
        event.tick = World.currentTick;

        this.updates.push(event);
        this.lastEvent = World.currentTick;
    }

    // ---- players/npcs are not zone tracked for events ----

    addPlayer(player: Player) {
        this.players.push(player);
    }

    removePlayer(player: Player) {
        const index = this.players.indexOf(player);
        if (index !== -1) {
            this.players.splice(index, 1);
        }
    }

    addNpc(npc: Npc) {
        this.npcs.push(npc);
    }

    removeNpc(npc: Npc) {
        const index = this.npcs.indexOf(npc);
        if (index !== -1) {
            this.npcs.splice(index, 1);
        }
    }

    // ---- static locs/objs are added during world init ----

    addStaticLoc(loc: Loc) {
        this.staticLocs.push(loc);
    }

    addStaticObj(obj: Obj) {
        this.staticObjs.push(obj);

        const event = new ZoneEvent(ServerProt.OBJ_ADD);
        event.buffer = Zone.objAdd(obj.x, obj.z, obj.id, obj.count);
        event.tick = World.currentTick;
        event.static = true;
        this.updates.push(event);
        this.lastEvent = World.currentTick;
    }

    // ----

    addLoc(loc: Loc, duration: number) {
        if (this.staticLocs.indexOf(loc) === -1) {
            loc.despawn = World.currentTick + duration;
            this.locs.push(loc);
        }

        const event = new ZoneEvent(ServerProt.LOC_ADD_CHANGE);
        event.buffer = Zone.locAddChange(loc.x, loc.z, loc.type, loc.shape, loc.angle);
        event.x = loc.x;
        event.z = loc.z;
        event.tick = World.currentTick;
        event.layer = LocShapes.layer(loc.shape);

        this.updates = this.updates.filter(event => {
            if (event.x === loc.x && event.z === loc.z && event.layer === LocShapes.layer(loc.shape)) {
                return false;
            }

            return true;
        });

        this.updates.push(event);
        this.lastEvent = World.currentTick;
    }

    removeLoc(loc: Loc, duration: number) {
        const event = new ZoneEvent(ServerProt.LOC_DEL);

        const dynamicIndex = this.locs.indexOf(loc);
        if (dynamicIndex !== -1) {
            this.locs.splice(dynamicIndex, 1);
        } else {
            // static locs remain forever in memory, just create a zone event
            loc.respawn = World.currentTick + duration;
            event.static = true;
        }

        event.buffer = Zone.locDel(loc.x, loc.z, loc.shape, loc.angle);
        event.x = loc.x;
        event.z = loc.z;
        event.tick = World.currentTick;
        event.layer = LocShapes.layer(loc.shape);

        this.updates = this.updates.filter(event => {
            if (event.x === loc.x && event.z === loc.z && event.layer === LocShapes.layer(loc.shape)) {
                return false;
            }

            return true;
        });

        this.updates.push(event);
        this.lastEvent = World.currentTick;
    }

    getLoc(x: number, z: number, type: number): Loc | null {
        const dynamicLoc = this.locs.findIndex(loc => loc.x === x && loc.z === z && loc.type === type);
        if (dynamicLoc !== -1) {
            return this.locs[dynamicLoc];
        }

        const staticLoc = this.staticLocs.findIndex(loc => loc.x === x && loc.z === z && loc.type === type && loc.respawn < World.currentTick);
        if (staticLoc !== -1) {
            return this.staticLocs[staticLoc];
        }

        return null;
    }

    mergeLoc(loc: Loc, player: Player, startCycle: number, endCycle: number, south: number, east: number, north: number, west: number) {
        const event = new ZoneEvent(ServerProt.LOC_MERGE);

        event.buffer = Zone.locMerge(loc.x, loc.z, loc.shape, loc.angle, loc.type, startCycle, endCycle, player.pid, east, south, west, north);
        event.x = loc.x;
        event.z = loc.z;
        event.tick = World.currentTick;
        event.layer = LocShapes.layer(loc.shape);

        this.updates.push(event);
        this.lastEvent = World.currentTick;
    }

    animLoc(loc: Loc, seq: number) {
        const event = new ZoneEvent(ServerProt.LOC_ANIM);

        event.buffer = Zone.locAnim(loc.x, loc.z, loc.shape, loc.angle, seq);
        event.x = loc.x;
        event.z = loc.z;
        event.tick = World.currentTick;
        event.layer = LocShapes.layer(loc.shape);

        this.updates.push(event);
        this.lastEvent = World.currentTick;
    }

    // ----

    addObj(obj: Obj, receiver: Player | null, duration: number) {
        const event = new ZoneEvent(ServerProt.OBJ_ADD);
        if (this.staticObjs.indexOf(obj) === -1) {
            obj.despawn = World.currentTick + duration;
            this.objs.push(obj);
        } else {
            event.static = true;
        }

        if (receiver) {
            event.receiverId = receiver.pid; // TODO: use uid not pid (!!!)
        }
        event.buffer = Zone.objAdd(obj.x, obj.z, obj.id, obj.count);
        event.x = obj.x;
        event.z = obj.z;
        event.tick = World.currentTick;

        this.updates.push(event);
        this.lastEvent = World.currentTick;
    }

    removeObj(obj: Obj, receiver: Player | null, subtractTick: number = 0) {
        const event = new ZoneEvent(ServerProt.OBJ_DEL);

        const dynamicIndex = this.objs.indexOf(obj);
        if (dynamicIndex !== -1) {
            this.objs.splice(dynamicIndex, 1);

            if (receiver) {
                event.receiverId = receiver.pid; // TODO: use uid not pid (!!!)
            }
        }

        event.buffer = Zone.objDel(obj.x, obj.z, obj.id, obj.count);
        event.x = obj.x;
        event.z = obj.z;
        event.tick = World.currentTick - subtractTick;

        this.updates.push(event);
        this.lastEvent = World.currentTick;
    }

    getObj(x: number, z: number, type: number): Obj | null {
        const dynamicObj = this.objs.findIndex(obj => obj.x === x && obj.z === z && obj.type === type);
        if (dynamicObj !== -1) {
            return this.objs[dynamicObj];
        }

        const staticObj = this.staticObjs.findIndex(obj => obj.x === x && obj.z === z && obj.type === type && obj.respawn < World.currentTick);
        if (staticObj !== -1) {
            return this.staticObjs[staticObj];
        }

        return null;
    }
}
