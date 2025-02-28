import World from '#lostcity/engine/World.js';
import ScriptProvider from '#lostcity/engine/script/ScriptProvider.js';
import ScriptRunner from '#lostcity/engine/script/ScriptRunner.js';
import Player from '#lostcity/entity/Player.js';

process.env.CLIRUNNER = 'true';

const args = process.argv.slice(2);

World.start(false);
const script = ScriptProvider.getByName(`[debugproc,${args[0]}]`);
if (!script) {
    console.error(`Script [debugproc,${args[0]}] not found`);
    process.exit(1);
}

const self = Player.load('clirunner');
World.addPlayer(self, null);

const state = ScriptRunner.init(script, self);
ScriptRunner.execute(state);

process.exit(0);
