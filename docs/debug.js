Global.DEBUG = {
    enabled: window.location.protocol == "file:" || window.location.hostname == "localhost",
    sync: true,
    shapes: {},
    nextShapeID: 0,
}

function syncDebugUI() {
    document.getElementById("debug-menu-button").style.display = (Global.DEBUG.enabled ? "" : "none"); // hide if not debug
    document.getElementById("debug_toggle").checked = Global.DEBUG.enabled;
    document.getElementById("debug_sync_toggle").checked = Global.DEBUG.sync;
}

syncDebugUI();

//TODO: print circle to json
function enableDebug() {
    Global.DEBUG.enabled = true;
    syncDebugUI();
}

function getNextShapeID() {
    // get next free id
    while (Global.DEBUG.shapes[Global.DEBUG.nextShapeID])
        Global.DEBUG.nextShapeID++;
    // return id
    return Global.DEBUG.nextShapeID;
}

const hostName = "tdebug-host";
const joinName = "tdebug-join";
function debugHost() {
    Global.MP.username = hostName;
    hostLobby();
    // hide menu
    setMenuVisible("menu", "bottom", false);
}

function debugJoin() {
    Global.MP.username = `${joinName}-${Math.floor(Math.random() * 1000).toString()}`;
    Global.MP.hostID = hostName;
    // skip the input step
    initPeer();
    // hide menu
    setMenuVisible("menu", "bottom", false);
}

function clearShapes() {
    // remove each shape
    for (let key in Global.DEBUG.shapes) {
        let shape = Global.DEBUG.shapes[key];
        if (shape)
            shape.remove();
    }
    // clear array
    Global.DEBUG.shapes = {};
}

function solveNextStep() {
    // iterate through all steps and unlock the first one that isnt unlocked yet
    if (!Global.currentCase)
        return;

    for (let step of Global.currentCase.steps) {
        let id = step.id;
        // already unlocked?
        if (Global.CASE.progress[id] == true)
            continue;

        solveStep(id);
        console.log(`Force unlocked step ${id}`);
        return;
    }
}