let camera, scene, renderer, world;
let originalBoxSize = 2;
let boxHeight = 0.2;
let speed = 0.12;
let stack, overhangs;
let gameEnded;
let startColor;
let difficulty = 'easy';

const scoreElement = document.getElementById("score")
const resultsElement = document.getElementById("results")
const play = document.getElementById("play")
const finalScore = document.getElementById("finalScore")
const difficultyEasy = document.getElementById("easy")
const difficultyElement = document.getElementById("difficulty")
const difficultyMedium = document.getElementById("medium")
const difficultyHard = document.getElementById("hard")
const slice = new Audio('https://www.soundjay.com/buttons/sounds/button-19.mp3')
const fail = new Audio('https://www.soundjay.com/misc/sounds/fail-buzzer-03.mp3')

init();

function init() {
    gameEnded = true;
    stack = [];
    overhangs = []

    document.querySelector("#easy").style.opacity = '1'

    startColor = Math.floor(Math.random() * 360 + 1)

    world = new CANNON.World();
    world.gravity.set(0, -10, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 40;

    // ThreeJS
    const aspect = window.innerWidth / window.innerHeight
    const width = 10;
    const height = width / aspect;
    camera = new THREE.OrthographicCamera(
        width / -2, //left
        width / 2, //right
        height / 2, //top
        height / -2, //bottom
        0, //near
        100 //far
    )
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);

    // SCENE
    scene = new THREE.Scene();

    // FOUNDATION
    addLayer(0, 0, originalBoxSize, originalBoxSize);

    // FIRST LAYER
    addLayer(-10, 0, originalBoxSize, originalBoxSize, 'x');

    // SET UP LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 0);
    scene.add(directionalLight)

    // RENDERER
    renderer = new THREE.WebGLRenderer({antialias: true})
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animation);
    document.body.appendChild(renderer.domElement);
}

function resetScene(diff) {
    gameEnded = true;
    stack = [];
    overhangs = [];
    if (scoreElement) scoreElement.innerText = 0;
    if (resultsElement) resultsElement.style.display = "none";
    if (play) play.style.display = "flex";
    if (difficultyElement) difficultyElement.style.display = "flex";
    if (diff) {
        document.querySelectorAll("#difficulty span").forEach(el => el.style.opacity = '0.2')
        document.querySelector(`#${diff}`).style.opacity = '1'
    }
    if (world) {
        // Remove every object from the world
        while (world.bodies.length > 0) {
            world.remove(world.bodies[0])
        }
    }
    if (scene) {
        // Remove every mesh from scene
        while (scene.children.find(c => c.type === 'Mesh')) {
            const mesh = scene.children.find(c => c.type === 'Mesh');
            scene.remove(mesh);
        }

        // FOUNDATION
        addLayer(0, 0, originalBoxSize, originalBoxSize);

        // FIRST LAYER
        addLayer(-10, 0, originalBoxSize, originalBoxSize, 'x');
    }
    if (camera) {
        //Reset camera positions
        camera.position.set(4, 4, 4);
        camera.lookAt(0, 0, 0);
    }
}

window.addEventListener("click", () => {
    if (!gameEnded) {
        const topLayer = stack[stack.length - 1];
        const prevLayer = stack[stack.length - 2];
        const direction = topLayer.direction

        const delta = topLayer.threejs.position[direction] - prevLayer.threejs.position[direction];
        const overhangSize = Math.abs(delta);
        const size = direction === 'x' ? topLayer.width : topLayer.depth;
        const overlap = size - overhangSize;
        if (overlap > 0) {
            slice.play()
            cutBox(topLayer, overlap, size, delta)
            // Calculate overhang
            const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta)
            const overhangX = direction === 'x' ? topLayer.threejs.position.x + overhangShift : topLayer.threejs.position.x;
            const overhangZ = direction === 'z' ? topLayer.threejs.position.z + overhangShift : topLayer.threejs.position.z;

            const overhangWidth = direction === 'x' ? overhangSize : topLayer.width;
            const overhangDepth = direction === 'x' ? overhangSize : topLayer.depth;

            addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth)

            // Next layer
            const nextX = direction === "x" ? topLayer.threejs.position.x : -10;
            const nextZ = direction === "z" ? topLayer.threejs.position.z : -10;
            const newWidth = topLayer.width;
            const newDepth = topLayer.depth;
            const nextDirection = direction === 'x' ? 'z' : 'x';
            if (scoreElement) scoreElement.innerText = stack.length - 1;
            addLayer(nextX, nextZ, newWidth, newDepth, nextDirection)
        } else missedTheSpot()
    }
})

function animation() {
    const topLayer = stack[stack.length - 1];
    if (!gameEnded) {
        topLayer.threejs.position[topLayer.direction] += speed;
        topLayer.cannonjs.position[topLayer.direction] += speed;
        if (topLayer.threejs.position[topLayer.direction] > 10) {
            missedTheSpot()
        }
    }
    if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
        camera.position.y += speed;
    }
    updatePhysics()
    renderer.render(scene, camera)
}

function updatePhysics() {
    world.step(1 / 60);
    // Copy coordinates from CannonJS to ThreeJS
    overhangs.forEach(element => {
        element.threejs.position.copy(element.cannonjs.position);
        element.threejs.quaternion.copy(element.cannonjs.quaternion);
    })
}

function addLayer(x, z, width, depth, direction) {
    const y = boxHeight * stack.length;
    const layer = generateBox(x, y, z, width, depth, false);
    layer.direction = direction;
    stack.push(layer)
}

function addOverhang(x, z, width, depth) {
    const y = boxHeight * (stack.length - 1);
    const overhang = generateBox(x, y, z, width, depth, true)
    overhangs.push(overhang)
}

function generateBox(x, y, z, width, depth, falls) {
    // ThreeJS
    const geometry = new THREE.BoxGeometry(width, boxHeight, depth);
    const color = new THREE.Color(`hsl(${startColor + stack.length * 4},100%,50%)`);
    const material = new THREE.MeshLambertMaterial({color});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    // CannonJS
    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2))
    let mass = falls ? 5 : 0;
    mass *= width / originalBoxSize;
    mass *= depth / originalBoxSize;
    const body = new CANNON.Body({mass, shape});
    body.position.set(x, y, z);
    world.addBody(body);

    return {
        threejs: mesh,
        cannonjs: body,
        width,
        depth
    }
}

function cutBox(topLayer, overlap, size, delta) {
    const direction = topLayer.direction;
    const newWidth = direction === 'x' ? overlap : topLayer.width;
    const newDepth = direction === 'z' ? overlap : topLayer.depth;

    // Update metadata
    topLayer.width = newWidth;
    topLayer.depth = newDepth;

    // Update threeJS model
    topLayer.threejs.scale[direction] = overlap / size;
    topLayer.threejs.position[direction] -= delta / 2;

    // Update CannonJS model
    topLayer.cannonjs.position[direction] -= delta / 2;

    // Replace shape to a smaller one
    const shape = new CANNON.Box(new CANNON.Vec3(newWidth / 2), boxHeight / 2, newDepth / 2)
    topLayer.cannonjs.shapes = []
    topLayer.cannonjs.addShape(shape);
}

function missedTheSpot() {
    const topLayer = stack[stack.length - 1];
    addOverhang(topLayer.threejs.position.x, topLayer.threejs.position.z, topLayer.width, topLayer.depth)
    world.remove(topLayer.cannonjs);
    scene.remove(topLayer.threejs);
    fail.play()
    if (finalScore) finalScore.innerText = stack.length - 2;
    if (resultsElement) resultsElement.style.display = "flex";
    gameEnded = true;
}

window.addEventListener("resize", () => {
    const aspect = window.innerWidth / window.innerHeight;
    const width = 10;
    const height = width / aspect;

    camera.top = height / 2;
    camera.bottom = height / -2;

    // Reset renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
});

if (difficultyEasy) {
    difficultyEasy.addEventListener("click", () => {
        boxHeight = 0.2;
        originalBoxSize = 2;
        speed = 0.12;
        resetScene('easy');
    })
}

if (difficultyMedium) {
    difficultyMedium.addEventListener("click", () => {
        boxHeight = 0.1;
        originalBoxSize = 1;
        speed = 0.15;
        resetScene('medium');
    })
}

if (difficultyHard) {
    difficultyHard.addEventListener("click", () => {
        boxHeight = 0.05;
        originalBoxSize = 0.5;
        speed = 0.20;
        resetScene('hard');
    })
}

window.addEventListener("keydown", function (event) {
    if (event.key == " " && gameEnded) {
        event.preventDefault();
        gameEnded = false;
        if (play) play.style.display = "none";
        if (difficultyElement) difficultyElement.style.display = "none";
        return;
    }
    if ((event.key == "R" || event.key == "r") && gameEnded) {
        event.preventDefault();
        resetScene();
        return;
    }
});
