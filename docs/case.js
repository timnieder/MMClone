Global.CASE = {
    objective: [],
    nodes: [],
    progress: {},
    selected: 0,
    completedSteps: 0
}

function handleCaseFile(event) {
    console.debug("Got Case File(s)");
    let files = event.target.files;
    let promises = []
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        console.debug(`Loading Case from ${file}`);
        promises.push(loadCaseJson(file));
    }

    // wait for all files to load
    Promise.all(promises).then(() => {
        // refresh cases
        refreshCases();
        alert(`Loaded ${files.length} Cases.`);
    });
}

const caseStoreName = "cases";
const caseImgStoreName = "images";
const caseDBName = "mmclone.cases";
let caseDbPromise;
// Returns a promise for the DB
function openCaseDB() {
    if (caseDbPromise)
        return caseDbPromise;

    caseDbPromise = idb.openDB(caseDBName, 2, {
        upgrade(db, oldVersion) {
            // INFO: mitigrations here
            // No store before => create new
            if (oldVersion < 1) {
                const caseStore = db.createObjectStore(caseStoreName, {
                    keyPath: 'id'
                });
                caseStore.createIndex('id', 'id');
                const caseImgStore = db.createObjectStore(caseImgStoreName, {
                    keyPath: 'id'
                });
                caseImgStore.createIndex('id', 'id');
            }
        }
    });
    return caseDbPromise;
}

// Loads json from a file and saves it into the db
async function loadCaseJson(file) {
    // load object into store. use json["id"] as key
    return new Promise((resolve, reject) => {
        // read json file
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
            // fetch + parse as json
            let text = event.target.result;
            let json = JSON.parse(text);
            console.debug(`Loaded case file ${file.name}`);
            saveCaseJson(json).then(() => resolve());
        });
        reader.readAsText(file);
    });
}

async function saveCaseJson(json) {
    console.debug(json);
    // open db
    return openCaseDB().then(db => {
        // save object in db
        return db.put(caseStoreName, json);
    });
}

// Deletes a case from the db
async function removeCase(key) {
    const db = await openCaseDB();
    return db.delete(caseStoreName, key);
}
// Deletes all cases from the db
async function clearCaseDB() {
    return (await openCaseDB()).clear(caseStoreName);
}

async function clearCaseImgDB() {
    return (await openCaseDB()).clear(caseStoreName);
}

async function saveCaseImage(folder, name, blob) {
    const db = await openCaseDB();
    let prefix = folder.split("cases/")[1].split("/")[0]; // remove "cases/", then take the first folder after that
    let id = `${prefix}_${name}`;
    return db.put(caseImgStoreName, {
        blob: blob,
        id: id
    });
}

async function loadCaseImage(caseName, img) {
    let key = `${caseName}_${img}`;
    return (await openCaseDB()).get(caseImgStoreName, key).then(result => result && result.blob)
}

async function getStepImageFront(step) {
    let img = step.image_front;
    if (!img)
        img = `${step.id}_front.png`
    return loadCaseImage(Global.currentCase.id, img)
}

async function getStepImageBack(step) {
    let img = step.image_back;
    if (!img)
        img = `${step.id}_back.png`
    return loadCaseImage(Global.currentCase.id, img)
}

// Does additional transformations for backwards compat
function prepareCases() {
    for (let id in Global.cases) {
        let cur = Global.cases[id];
        cur.steps.forEach((step, index) => {
            // Requires
            if (!step.requires || step.requires instanceof Array) {
                // create default requires
                if (index > 0)
                    step.requires = [cur.steps[index - 1].id];
                else // first one has no requirement
                    step.requires = [];
            }
        });
    }
}

// Read cases from db and load them into the frontend
async function refreshCases() {
    // Get cases from db
    const db = await openCaseDB();
    let cases = await db.getAll(caseStoreName);

    console.debug(`Loaded ${cases.length} Cases from idb`);
    if (cases.length == 0)
        return;

    // copy into global var
    Global.cases = {}
    for (let key in cases) {
        let val = cases[key];
        Global.cases[val["id"]] = val;
    }
    // prepare loaded cases //TODO: do before storing cases into db?
    prepareCases();

    // Put into select
    let select = document.getElementById("select_case");
    // clear select
    select.innerHTML = "";
    // append cases to select
    for (let key in Global.cases) {
        let val = Global.cases[key];
        let text = val.difficulty ? `${val.name} (${val.difficulty})` : val.name
        select.append(new Option(text, key));
    }
    // set to starting case
    let startCase = Global.MAP.metadata.startCase;
    if (startCase) {
        if (Object.keys(Global.cases).find(c => c == startCase)) {
            select.value = startCase;
        } else {
            console.log(`Starting case ${startCase} not found.`);
        }
    }


    let id = select.value;
    // Manually call the change func
    handleCaseChange(id);
}

function changeCase(id) {
    let select = document.getElementById("select_case");
    let index = null;
    for (let i in select.options) {
        let opt = select.options[i];
        if (opt.value == id) {
            index = i;
            break;
        }
    }
    if (!index) {
        console.log(`Case with ID ${id} not found.`);
        return false;
    }
    select.selectedIndex = index;
    // select event doesnt trigger, call manually
    handleCaseChangeCall(id);
    return true;
}

function handleCaseChange(id) {
    sendChangeCase(id);
    handleCaseChangeCall(id);
}

function handleCaseChangeCall(id) {
    let selected = Global.cases[id];
    if (!selected)
        return;

    Global.currentCase = selected;
    Global.CASE.progress = {};
    buildCards();
    updateCaseStep();
    console.debug(`Selected case ${selected.name} (ID ${selected.id})`);
}

function resetCase() {
    if (!Global.currentCase)
        return;

    sendResetCase();
    resetCaseCall();
}

function resetCaseCall() {
    if (!Global.currentCase)
        return;

    Global.CASE.progress = {};
    Global.CASE.completedSteps = 0;
    Global.CASE.selected = 0;
    // just rebuild cards lmao
    buildCards();
    updateCaseStep();
    console.debug(`Reset case ${Global.currentCase.name} (ID ${Global.currentCase.id})`);
}

// Updates the objective text and markers.
function updateCaseStep() {
    //TODO: this currently only shows one step's markers
    let step = Global.currentCase.steps[Global.CASE.selected];
    if (!step)
        return;
    // update solutions
    clearCaseMarkers();

    // then add the new ones
    let root = buildStepNodes(step);
    // update objective label
    Global.CASE.objective = step.text ? step.text : "";
    if (root && root.counter != null) {
        updateObjective(Global.CASE.objective, root.counter, root.children.length);
    } else
        updateObjective(Global.CASE.objective, null, null);

    console.debug(`Built ${Global.CASE.nodes.length} nodes.`);
    console.debug(`Added ${Global.caseMarkers.length} new markers`);
}

function clearCaseMarkers() {
    // clear existing circles
    console.debug(`Removing ${Global.caseMarkers.length} markers`);
    for (let key in Global.caseMarkers) {
        let val = Global.caseMarkers[key];
        val.remove();
    }
    Global.caseMarkers = [];
}

function buildStepNodes(step) {
    Global.CASE.nodes = [];
    if (step.solution) {
        let root = buildStepNode(step.solution, null);
        root.step = step.id;
        return root;
    }
    return null;
}

function solveParent(node) {
    // mark this node as done
    node.done = true;
    // pass to parent
    if (node.parent == null)
        solveStep(node.step);
    else
        solveNode(node.parent);
}

function solveNode(node) {
    if (node.done)
        return;

    console.debug(`Solving node ${node.type}`);
    switch (node.type) {
        case "or":
        case "circle": {
            solveParent(node);
            break;
        }
        case "and": {
            let solved = incrementNodeCall(node);
            // only inform other clients if the node wasnt solved. else solveStep should do it (in hopes of defeating potential desync)
            if (!solved) // also send all done nodes to the other clients
                sendIncrementNode(node.id, node.children.filter(n => n.done).map(n => n.id));
            break;
        }
        default: {
            console.log(`solveNode: Unknown Type ${s.type}`);
            break;
        }
    }
}

function incrementNode(id, solved) {
    let node = Global.CASE.nodes[id];
    if (!node || node.done)
        return;

    // increment the node counter
    incrementNodeCall(node);
    // mark all solved nodes as done
    solved.forEach((i) => {
        let node = Global.CASE.nodes[i];
        if (node)
            node.done = true;
    })
}

// increments the counter on a node. returns true if the node was solved.
function incrementNodeCall(node) {
    node.counter++;
    if (node.counter >= node.children.length) {
        solveParent(node);
        return true;
    }

    //TODO: delete all done children?

    // only update the top node
    if (node.parent == null)
        updateObjective(Global.CASE.objective, node.counter, node.children.length);
    return false;
}

function buildStepNode(node, parent) {
    // create new node
    let id = Global.CASE.nodes.length;
    let n = {
        type: node.type,
        id: id,
        parent: parent,
        children: [],
    };
    Global.CASE.nodes[id] = n;

    switch (node.type) {
        case "circle": {
            const fillColor = Global.DEBUG.enabled ? "#f00" : "#fff";
            const opacity = Global.DEBUG.enabled ? 0.5 : 0;
            var circle = L.circle([node.y, node.x], {
                contextmenu: true,
                color: "none",
                fillColor: fillColor,
                fillOpacity: opacity,
                radius: node.radius,
                bubblingMouseEvents: false, // needed or else we cause a map contextmenu event
            });
            circle.addTo(Global.map);
            circle.addEventListener("click", () => solveNode(n));
            Global.caseMarkers.push(circle);
            break;
        }
        case "and": {
            n.counter = 0;
            node.nodes.forEach((child) => {
                n.children.push(buildStepNode(child, n));
            });
            break;
        }
        case "or": {
            node.nodes.forEach((child) => {
                n.children.push(buildStepNode(child, n));
            });
            break;
        }
        default: {
            console.log(`buildStepNode: Unknown Type ${s.type}`);
            break;
        }
    }
    return n;
}

function solveStep(id) {
    if (!Global.currentCase)
        return;

    // send mp
    sendSolveStep(id)
    // call rpc func
    solveStepCall(id)
}
// Solves the current step and shows the solution. Also unlocks the next button.
function solveStepCall(id) {
    if (!Global.currentCase)
        return;

    let index = Global.currentCase.steps.findIndex(s => s.id == id);
    let step = Global.currentCase.steps[index];
    if (!step)
        return;

    //INFO: if step is solved, open menu, flip card, unlock next card. thats all
    console.debug(`Solved Step ${id}`);
    Global.CASE.progress[id] = true;
    // slide instantly to next current card
    Global.UI.swiper.slideTo(index, 0);
    // open menu
    setMenuVisible("card-menu", "top", true);
    // flip card, stamp if there was a solution
    flipCard(index, step.solution != null).then(() => {
        // try to unlock next card
        progressCase();
    });
}

function setCaseProgress(progress) {
    Global.CASE.progress = progress;

    // TODO: remove this shitty hack and just show all solved cards with no animation
    let keys = Object.keys(progress);
    let last = keys[keys.length - 1];
    Global.CASE.progress[last] = false;
    // filter for true values
    Global.CASE.completedSteps = Object.values(Global.CASE.progress).filter(s => s).length;

    // update cards to flip and unlock each cards
    updateCards();
    // then solve that step to do all the necessary stuff
    solveStepCall(last);
}

// Increases the case progress and updates the objective and solution text.
function progressCase() {
    if (!Global.currentCase) {
        alert("No case selected!");
        return;
    }

    console.debug(`Increasing case step from ${Global.CASE.completedSteps}`);
    Global.CASE.completedSteps++;
    //TODO: dont auto select next case here? may be annoying/confusing if you get kicked out of your curcase
    Global.CASE.selected = getNextStep();

    // update cards
    updateCards();
    //TODO: end of case animation or smth
    if (Global.CASE.completedSteps == Global.currentCase.steps.length) {
        console.debug("Reached the end of the case.");
        // clear any case leftovers
        Global.CASE.objective = "";
        clearCaseMarkers();
        updateObjective(Global.CASE.objective, null, null);
        // add finished tag so its made clickable
        Global.UI.swiper.wrapperEl.classList.add("finished");
        return;
    }

    // update the case
    updateCase();
}

// used to update the case. if you want to progress, use progressCase();
function updateCase() {
    updateCaseStep();
}

function hasStepSolved(step) {
    return Global.CASE.progress[step.id] == true;
}

function hasStepUnlocked(step) {
    for (let id of step.requires) {
        if (!Global.CASE.progress[id])
            return false;
    }
    return true;
}

function stepActive(step) {
    return !hasStepSolved(step) && hasStepUnlocked(step);
}

function getNextStep() {
    // find the first case that is unlocked but still unsolved
    for (let i = 0; i < Global.currentCase.steps.length; i++) {
        let step = Global.currentCase.steps[i];
        if (stepActive(step))
            return i;
    }
    console.debug("No next step found. End of case?")
    return Global.CASE.completedSteps;
}