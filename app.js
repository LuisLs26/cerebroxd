/* ==========================================================================
   CEREBRO 3D INTERACTIVO — MOTOR PRINCIPAL
   Separación anatómica precisa por lóbulo mediante división geométrica,
   estructuras subcorticales independientes, raycasting exacto por malla.
   ========================================================================== */

// ─── GLOBALS ───────────────────────────────────────────────────────────────
let scene, camera, renderer, labelRenderer, controls;
let brainGroup, leftHemisphere, rightHemisphere;

let isSplit = false;
let autoRotateActive = true;
let currentCortexOpacity = 1.0;
let selectedStructure = null;
let hoveredStructure = null;
let modelLoaded = false;

// Variables de transición para zoom y encuadre de cámara suave
let isTransitioning = false;
let targetCameraPosition = new THREE.Vector3(0, 1.5, 5);

const interactiveObjects = [];
const cortexMeshes = [];     // mallas de lóbulos separados
const staticMeshes = [];     // cerebelo + tronco
const subcorticalHalos = []; // halos holográficos de subcorticales

// Colores de realce UI (emissive glow al seleccionar/hover)
const COLORS = {
    frontal:     new THREE.Color(0x2563eb),
    prefrontal:  new THREE.Color(0x06b6d4),
    parietal:    new THREE.Color(0x6366f1),
    temporal:    new THREE.Color(0x3b82f6),
    occipital:   new THREE.Color(0x1e3a8a),
    talamo:      new THREE.Color(0xe89050),
    basales:     new THREE.Color(0xd4a830),
    hipocampo:   new THREE.Color(0x9878c8),
    amigdala:    new THREE.Color(0xd88098),
    cerebellum:  new THREE.Color(0x64748b),
    brainstem:   new THREE.Color(0x94a3b8)
};

// Colores anatómicos de maqueta médica para el modelo 3D (tonos crema/piel extremadamente claros y elegantes)
const SKIN_COLORS = {
    frontal:     0xfdf4eb, // Alabastro / Crema rosado muy claro
    prefrontal:  0xfff6f0, // Concha marina / Crema ultra claro
    parietal:    0xfdf5e6, // Encaje antiguo / Crema marfil
    temporal:    0xfffaf0, // Blanco floral / Marfil
    occipital:   0xfaf3e8, // Arena suave muy claro
    cerebellum:  0xf5ebe0, // Lino / Contraste suave ligeramente más beige
    brainstem:   0xfaf0e6, // Lino claro
    talamo:      0xffb888, // Naranja pastel muy suave
    basales:     0xffe890, // Amarillo pastel muy suave
    hipocampo:   0xe8cfff, // Lavanda pastel muy suave
    amigdala:    0xffccd8  // Rosa pastel muy suave
};

// ─── DATA ──────────────────────────────────────────────────────────────────
const brainData = {
    frontal: {
        title: "Lóbulo Frontal",
        tag: "Corteza Cerebral",
        color: "var(--color-frontal)",
        desc: "Participa en la planificación, la toma de decisiones y el control de la conducta.",
        learning: "Cuando un estudiante organiza sus materiales, sigue instrucciones y decide cómo resolver una actividad en clase, está usando el lóbulo frontal.",
        image: "frontal.png"
    },
    prefrontal: {
        title: "Corteza Prefrontal",
        tag: "Corteza Cerebral",
        color: "var(--color-prefrontal)",
        desc: "Regula funciones ejecutivas como controlar impulsos, concentrarse y orientar acciones hacia una meta.",
        learning: "Cuando un estudiante espera su turno, se concentra y termina una actividad aunque haya distracciones, participa la corteza prefrontal.",
        image: "prefrontal.png"
    },
    parietal: {
        title: "Lóbulo Parietal",
        tag: "Corteza Cerebral",
        color: "var(--color-parietal)",
        desc: "Integra la información sensorial y espacial.",
        learning: "Cuando un estudiante atrapa una pelota, escribe respetando el espacio en su cuaderno o ubica objetos en el aula.",
        image: "parietal.png"
    },
    temporal: {
        title: "Lóbulo Temporal",
        tag: "Corteza Cerebral",
        color: "var(--color-temporal)",
        desc: "Memoria, lenguaje y procesamiento auditivo.",
        learning: "Cuando escucha la explicación del docente, recuerda una indicación y responde oralmente.",
        image: "temporal.png"
    },
    occipital: {
        title: "Lóbulo Occipital",
        tag: "Corteza Cerebral",
        color: "var(--color-occipital)",
        desc: "Procesamiento visual.",
        learning: "Cuando observa la pizarra, lee un texto o reconoce imágenes y colores.",
        image: "occipital.png"
    },
    talamo: {
        title: "Tálamo",
        tag: "Estructura Subcortical",
        color: "var(--color-talamo)",
        desc: "Organiza y distribuye información sensorial.",
        learning: "Cuando escucha una indicación y al mismo tiempo observa el material de trabajo.",
        image: null
    },
    basales: {
        title: "Ganglios Basales",
        tag: "Estructura Subcortical",
        color: "var(--color-basales)",
        desc: "Formación de hábitos y adaptación de la conducta.",
        learning: "Cuando realiza una rutina como formar fila o escribir automáticamente su nombre.",
        image: null
    },
    hipocampo: {
        title: "Hipocampo",
        tag: "Estructura Subcortical",
        color: "var(--color-hipocampo)",
        desc: "Formación de recuerdos.",
        learning: "Cuando recuerda lo aprendido en la clase anterior y lo aplica.",
        image: null
    },
    amigdala: {
        title: "Amígdala",
        tag: "Estructura Subcortical",
        color: "var(--color-amigdala)",
        desc: "Regulación emocional.",
        learning: "Cuando siente alegría por lograr una actividad o nervios al participar.",
        image: null
    }
};

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const targetControlsTarget = new THREE.Vector3(0, 0, 0);

// ─── INIT ──────────────────────────────────────────────────────────────────
function init() {
    const container = document.getElementById('canvas-container');
    const w = container.clientWidth, h = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 50);
    camera.position.set(0, 1.5, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(w, h);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.getElementById('labels-container').appendChild(labelRenderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.zoomSpeed = 0.6;
    controls.rotateSpeed = 0.9;
    controls.maxDistance = 6.5;
    controls.minDistance = 2.4;
    controls.target.set(0, 0, 0);

    // Interrumpir transición automática de cámara si el usuario interactúa manualmente
    controls.addEventListener('start', () => {
        isTransitioning = false;
    });

    // Doble clic para regresar a vista panorámica general
    renderer.domElement.addEventListener('dblclick', () => {
        deselectAll();
    });

    setupLights();
    setupUIEventListeners();

    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Cargar modelo embebido automáticamente
    loadEmbeddedModel();
}

// ─── LIGHTS ────────────────────────────────────────────────────────────────
function setupLights() {
    // Luz hemisférica para iluminación ambiental suave
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x333333, 0.4);
    scene.add(hemiLight);

    // Key Light — frente-derecha-superior
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(6, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.camera.left = -2.5;
    keyLight.shadow.camera.right = 2.5;
    keyLight.shadow.camera.top = 2.5;
    keyLight.shadow.camera.bottom = -2.5;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Fill Light — izquierda con tono frío
    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.6);
    fillLight.position.set(-6, 3, 4);
    scene.add(fillLight);

    // Rim Light — trasera-superior para resaltar surcos y silueta
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.0);
    rimLight.position.set(0, 6, -6);
    scene.add(rimLight);

    // Luz de rebote inferior suave
    const bottomLight = new THREE.DirectionalLight(0xffedd5, 0.25);
    bottomLight.position.set(0, -6, 0);
    scene.add(bottomLight);
}

// ─── LOAD MODEL FROM EMBEDDED BASE64 ──────────────────────────────────────
function loadEmbeddedModel() {
    if (typeof BRAIN_MODEL_BASE64 === 'undefined') {
        console.error('brain-data.js no cargó correctamente.');
        return;
    }

    // Decodificar base64 a ArrayBuffer
    const binaryString = atob(BRAIN_MODEL_BASE64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Crear ObjectURL que GLTFLoader puede consumir sin CORS
    const blob = new Blob([bytes.buffer], { type: 'model/gltf-binary' });
    const objectURL = URL.createObjectURL(blob);

    const loader = new THREE.GLTFLoader();

    // Configurar DRACOLoader para modelos comprimidos con Draco
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    loader.setDRACOLoader(dracoLoader);

    loader.load(objectURL, (gltf) => {
        onModelLoaded(gltf);
        URL.revokeObjectURL(objectURL);

        setTimeout(() => {
            document.getElementById('loader-screen').classList.add('hidden');
        }, 600);
    }, undefined, (err) => {
        console.error('Error cargando modelo:', err);
    });
}

// ─── MODEL PROCESSING ──────────────────────────────────────────────────────
function onModelLoaded(gltf) {
    if (modelLoaded) return;
    modelLoaded = true;

    brainGroup = new THREE.Group();
    scene.add(brainGroup);

    rightHemisphere = gltf.scene;

    // ── Centrar y escalar ──
    const box = new THREE.Box3().setFromObject(rightHemisphere);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    rightHemisphere.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const sc = 2.2 / maxDim;
    rightHemisphere.scale.set(sc, sc, sc);

    // ── Recopilar mallas para procesamiento ──
    const meshesToSplit = [];
    const meshesStatic = [];

    rightHemisphere.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const name = child.name;

        if (name.includes('Object_10') || name.includes('Object_11')) {
            meshesToSplit.push({ mesh: child, type: 'frontal_parietal' });
        } else if (name.includes('Object_13') || name.includes('Object_14')) {
            meshesToSplit.push({ mesh: child, type: 'temporal_occipital' });
        } else if (name.includes('Object_7') || name.includes('Object_8')) {
            meshesStatic.push({ mesh: child, id: 'cerebellum' });
        } else if (name.includes('Object_4') || name.includes('Object_5')) {
            meshesStatic.push({ mesh: child, id: 'brainstem' });
        }
    });

    // ── Procesar mallas estáticas (cerebelo y tronco en su estado original) ──
    meshesStatic.forEach(({ mesh, id }) => {
        const mat = mesh.material.clone();
        mat.transparent = false;
        mat.opacity = 1.0;
        mat.side = THREE.DoubleSide;
        if (mat.emissive) { mat.emissive.set(0x000000); mat.emissiveIntensity = 0; }
        mesh.material = mat;
        mesh.userData = { isStatic: true, lobeId: id };
        staticMeshes.push(mesh);
    });

    // ── SEPARAR mallas de corteza en mallas individuales ──
    meshesToSplit.forEach(({ mesh, type }) => {
        splitCortexMesh(mesh, type, 'right');
    });

    // ── CREAR ESTRUCTURAS SUBCORTICALES ORGÁNICAS INDEPENDIENTES ──
    createSubcorticalStructures();

    // ── Clonar hemisferio izquierdo (espejo) ──
    leftHemisphere = rightHemisphere.clone();
    leftHemisphere.scale.x = -sc;

    leftHemisphere.traverse(child => {
        if (!child.isMesh) return;
        child.material = child.material.clone();
        child.material.side = THREE.DoubleSide;
        child.userData = Object.assign({}, child.userData);
        child.userData.side = 'left';
        if (child.userData.isCortex) {
            cortexMeshes.push(child);
            interactiveObjects.push(child);
        } else if (child.userData.isSubcortical) {
            interactiveObjects.push(child);
        } else if (child.userData.isStatic) {
            staticMeshes.push(child);
        } else if (child.userData.isHalo) {
            subcorticalHalos.push(child);
        }
    });

    brainGroup.add(leftHemisphere);
    brainGroup.add(rightHemisphere);

    // ── Etiquetas flotantes ──
    setupLabels();

    // ── Iniciar render loop ──
    animate();
}

// ═══════════════════════════════════════════════════════════════════════════
//  SEPARACIÓN ANATÓMICA DE CORTEZA POR LÓBULO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clasifica un vértice a un lóbulo basándose en su posición relativa
 * dentro del bounding box de la malla combinada.
 *
 * Coordenadas relativas: [0,1] donde
 *   relZ = 0 → posterior (atrás)     relZ = 1 → anterior (frente)
 *   relY = 0 → inferior (abajo)      relY = 1 → superior (arriba)
 *   relX = 0 → medial (centro)       relX = 1 → lateral (lado)
 */
function classifyVertexToLobe(meshType, relX, relY, relZ) {
    if (meshType === 'frontal_parietal') {
        // Prefrontal: polo frontal más anterior
        if (relZ > 0.74) return 'prefrontal';
        // Frontal: porción anterior (detrás del prefrontal, delante del surco central)
        if (relZ > 0.40) return 'frontal';
        // Parietal: porción posterior (detrás del surco central)
        return 'parietal';
    }
    if (meshType === 'temporal_occipital') {
        // Occipital: polo posterior
        if (relZ < 0.32) return 'occipital';
        // Temporal: resto del lóbulo temporal
        return 'temporal';
    }
    return 'frontal'; // fallback
}

/**
 * Divide una malla combinada del GLB en mallas independientes de corteza.
 */
function splitCortexMesh(mesh, meshType, side) {
    const geo = mesh.geometry;
    if (!geo || !geo.attributes.position) return;

    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const bbSize = new THREE.Vector3();
    bb.getSize(bbSize);

    // Evitar división por cero
    if (bbSize.x === 0) bbSize.x = 1;
    if (bbSize.y === 0) bbSize.y = 1;
    if (bbSize.z === 0) bbSize.z = 1;

    const pos = geo.attributes.position;
    const normal = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const index = geo.index;

    // ── Paso 1: Clasificar cada vértice ──
    const vertexLobes = new Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const relX = (x - bb.min.x) / bbSize.x;
        const relY = (y - bb.min.y) / bbSize.y;
        const relZ = (z - bb.min.z) / bbSize.z;
        vertexLobes[i] = classifyVertexToLobe(meshType, relX, relY, relZ);
    }

    // ── Paso 2: Agrupar triángulos por lóbulo ──
    const lobeTriangles = {};
    const faceCount = index ? index.count / 3 : pos.count / 3;

    for (let f = 0; f < faceCount; f++) {
        const a = index ? index.getX(f * 3)     : f * 3;
        const b = index ? index.getX(f * 3 + 1) : f * 3 + 1;
        const c = index ? index.getX(f * 3 + 2) : f * 3 + 2;

        const lobes = [vertexLobes[a], vertexLobes[b], vertexLobes[c]];
        const counts = {};
        lobes.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
        let maxCount = 0, winnerLobe = lobes[0];
        for (const [k, v] of Object.entries(counts)) {
            if (v > maxCount) { maxCount = v; winnerLobe = k; }
        }

        if (!lobeTriangles[winnerLobe]) lobeTriangles[winnerLobe] = [];
        lobeTriangles[winnerLobe].push(a, b, c);
    }

    // ── Paso 3: Crear mallas individuales ──
    const parent = mesh.parent;

    for (const [lobeId, faceIndices] of Object.entries(lobeTriangles)) {
        if (faceIndices.length === 0) continue;

        const vertMap = new Map();
        const newPos = [], newNorm = [], newUV = [], newIdx = [];
        let newVertCount = 0;

        for (let i = 0; i < faceIndices.length; i++) {
            const oldIdx = faceIndices[i];
            if (!vertMap.has(oldIdx)) {
                vertMap.set(oldIdx, newVertCount);
                newPos.push(pos.getX(oldIdx), pos.getY(oldIdx), pos.getZ(oldIdx));
                if (normal) newNorm.push(normal.getX(oldIdx), normal.getY(oldIdx), normal.getZ(oldIdx));
                if (uv) newUV.push(uv.getX(oldIdx), uv.getY(oldIdx));
                newVertCount++;
            }
            newIdx.push(vertMap.get(oldIdx));
        }

        const newGeo = new THREE.BufferGeometry();
        newGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
        if (newNorm.length > 0) newGeo.setAttribute('normal', new THREE.Float32BufferAttribute(newNorm, 3));
        if (newUV.length > 0) newGeo.setAttribute('uv', new THREE.Float32BufferAttribute(newUV, 2));
        newGeo.setIndex(newIdx);
        newGeo.computeBoundingBox();
        newGeo.computeBoundingSphere();

        const mat = mesh.material.clone();
        mat.color.setHex(SKIN_COLORS[lobeId] || 0xeac7b9);
        mat.transparent = false;
        mat.opacity = 1.0;
        mat.side = THREE.DoubleSide;
        if (mat.emissive) { mat.emissive.set(0x000000); mat.emissiveIntensity = 0; }

        const lobeMesh = new THREE.Mesh(newGeo, mat);
        lobeMesh.position.copy(mesh.position);
        lobeMesh.rotation.copy(mesh.rotation);
        lobeMesh.scale.copy(mesh.scale);
        lobeMesh.castShadow = true;
        lobeMesh.receiveShadow = true;

        const isCortex = ['frontal', 'prefrontal', 'parietal', 'temporal', 'occipital'].includes(lobeId);
        const isStatic = ['brainstem', 'cerebellum'].includes(lobeId);

        lobeMesh.userData = {
            structureId: lobeId,
            isCortex: isCortex,
            isSubcortical: false,
            isStatic: isStatic,
            side: side
        };

        parent.add(lobeMesh);
        if (isCortex) {
            cortexMeshes.push(lobeMesh);
        } else if (isStatic) {
            staticMeshes.push(lobeMesh);
        }
        interactiveObjects.push(lobeMesh);
    }

    // Remover la malla combinada original
    parent.remove(mesh);
    geo.dispose();
    if (mesh.material.dispose) mesh.material.dispose();
}

/**
 * Crea colisionadores invisibles y halos holográficos para las cuatro estructuras subcorticales.
 */
function createSubcorticalStructures() {
    const subcorticals = [
        { id: 'talamo', pos: new THREE.Vector3(0.04, 0.12, -0.05), radius: 0.14 },
        { id: 'basales', pos: new THREE.Vector3(0.08, 0.10, 0.20), radius: 0.15 },
        { id: 'hipocampo', pos: new THREE.Vector3(0.05, -0.08, -0.12), radius: 0.11 },
        { id: 'amigdala', pos: new THREE.Vector3(0.06, -0.12, 0.08), radius: 0.09 }
    ];

    subcorticals.forEach(({ id, pos, radius }) => {
        // A. Colisionador esférico invisible para Raycasting
        const targetGeo = new THREE.SphereGeometry(radius, 16, 16);
        const targetMat = new THREE.MeshBasicMaterial({
            visible: false, // completamente invisible en la escena
            transparent: true,
            opacity: 0.0
        });
        const targetMesh = new THREE.Mesh(targetGeo, targetMat);
        targetMesh.position.copy(pos);
        targetMesh.userData = {
            structureId: id,
            isCortex: false,
            isSubcortical: true,
            isStatic: false,
            side: 'right'
        };

        rightHemisphere.add(targetMesh);
        interactiveObjects.push(targetMesh);

        // B. Halo holográfico de realce brillante
        const haloGeo = new THREE.SphereGeometry(radius * 0.95, 32, 32);
        const colorHex = COLORS[id] || new THREE.Color(0xffffff);
        const haloMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.0, // invisible por defecto
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        haloMesh.position.copy(pos);
        haloMesh.userData = {
            structureId: id,
            isHalo: true,
            baseRadius: radius * 0.95
        };

        rightHemisphere.add(haloMesh);
        subcorticalHalos.push(haloMesh);
    });
}


// ─── LABELS ────────────────────────────────────────────────────────────────
function setupLabels() {
    const anchors = {
        frontal:     new THREE.Vector3( 0.32,  0.22,  0.30),
        prefrontal:  new THREE.Vector3( 0.18,  0.02,  0.75),
        parietal:    new THREE.Vector3( 0.32,  0.34, -0.30),
        temporal:    new THREE.Vector3( 0.50, -0.12,  0.06),
        occipital:   new THREE.Vector3( 0.28,  0.02, -0.75),
        talamo:      new THREE.Vector3( 0.06,  0.12, -0.05),
        basales:     new THREE.Vector3( 0.10,  0.10,  0.20),
        hipocampo:   new THREE.Vector3( 0.07, -0.08, -0.12),
        amigdala:    new THREE.Vector3( 0.08, -0.12,  0.08)
    };

    for (const [id, pos] of Object.entries(anchors)) {
        const data = brainData[id];
        const cat = data.tag === 'Corteza Cerebral' ? 'Corteza' : 'Subcortical';

        const div = document.createElement('div');
        div.className = 'brain-label hidden';
        div.style.color = data.color;

        const dot = document.createElement('div');
        dot.className = 'label-dot';
        div.appendChild(dot);

        const line = document.createElement('div');
        line.className = 'label-line';
        div.appendChild(line);

        const box = document.createElement('div');
        box.className = 'label-box';
        const sp = document.createElement('span'); sp.innerText = cat; box.appendChild(sp);
        const h5 = document.createElement('h5'); h5.innerText = data.title; box.appendChild(h5);
        div.appendChild(box);

        box.addEventListener('click', (e) => { e.stopPropagation(); selectStructure(id); });

        const anchor = new THREE.Object3D();
        anchor.position.copy(pos);
        anchor.userData = { isLabelAnchor: true, structureId: id };
        const labelObj = new THREE.CSS2DObject(div);
        anchor.add(labelObj);
        rightHemisphere.add(anchor);
    }
}

function updateLabelsVisibility() {
    rightHemisphere.traverse(obj => {
        if (!obj.userData.isLabelAnchor) return;
        const id = obj.userData.structureId;
        const label = obj.children[0];
        if (!label || !label.element) return;
        const el = label.element;

        const isSelected = selectedStructure && (id === selectedStructure);
        const isHovered = hoveredStructure && (id === hoveredStructure) && !selectedStructure;

        if (isSelected || isHovered) {
            el.classList.remove('hidden');
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
        } else {
            el.classList.add('hidden');
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
        }
    });
}

// ─── RAYCASTING (EXACTO — cada lóbulo es su propia malla) ─────────────────
function getStructureFromHit(hit) {
    const mesh = hit.object;
    // Lectura directa: cada malla tiene su structureId asignado
    if (mesh.userData.structureId) return mesh.userData.structureId;
    return null;
}

function onPointerMove(ev) {
    if (!modelLoaded) return;
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactiveObjects);

    if (hits.length > 0) {
        const id = getStructureFromHit(hits[0]);
        if (id && hoveredStructure !== id) {
            hoveredStructure = id;
            document.body.style.cursor = 'pointer';
            if (!selectedStructure) highlightHover(id);
        }
    } else if (hoveredStructure) {
        hoveredStructure = null;
        document.body.style.cursor = 'default';
        if (!selectedStructure) resetMaterials();
    }
}

function onPointerDown() {
    if (!modelLoaded) return;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactiveObjects);
    if (hits.length > 0) {
        const hitObj = hits[0].object;
        const id = getStructureFromHit(hits[0]);
        const side = (hitObj.userData && (hitObj.userData.side || hitObj.userData.hemisphere)) || 'right';
        if (id) selectStructure(id, side);
    } else {
        deselectAll();
    }
}

function highlightHover(id) {
    // Resaltar SOLO la malla del lóbulo exacto con su color temático
    cortexMeshes.forEach(m => {
        const isThis = m.userData.structureId === id;
        if (m.material.emissive) {
            if (isThis) {
                m.material.emissive.copy(COLORS[id] || new THREE.Color(0x60a5fa));
                m.material.emissiveIntensity = 0.35;
            } else {
                m.material.emissive.set(0x000000);
                m.material.emissiveIntensity = 0;
            }
        }
    });

    updateLabelsVisibility();
}

function resetMaterials() {
    cortexMeshes.forEach(m => {
        if (m.material.emissive) {
            m.material.emissive.set(0x000000);
            m.material.emissiveIntensity = 0;
        }
    });
    updateLabelsVisibility();
}

// ─── SELECTION ─────────────────────────────────────────────────────────────
function selectStructure(id, side = 'right') {
    // Si ya está seleccionado, deseleccionar
    if (selectedStructure === id) {
        deselectAll();
        return;
    }
    selectedStructure = id;
    updateDetailsCard(id);
    updateSidebarList(id);
    updateLabelsVisibility();
    // focusCamera(id, side); // Se desactiva el zoom automático por requerimiento del usuario

    // Ajustar opacidad automática
    currentCortexOpacity = 1.0;
    updateBaseOpacity();
}

function deselectAll() {
    selectedStructure = null;
    resetMaterials();
    document.getElementById('details-card').classList.add('hidden');
    document.querySelectorAll('.structure-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.menu-btn, .section-title').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-global-view').classList.add('active');

    // Regresar cámara suavemente
    targetControlsTarget.set(0, 0, 0);
    targetCameraPosition.set(0, 1.5, 5);
    controls.minDistance = 2.4;
    isTransitioning = true;

    currentCortexOpacity = 1.0;
    updateBaseOpacity();
    updateLabelsVisibility();
}

function focusCamera(id, side = 'right') {
    const targets = {
        frontal: [0.28, 0.18, 0.28],
        prefrontal: [0.18, 0.02, 0.65],
        parietal: [0.28, 0.30, -0.28],
        temporal: [0.45, -0.10, 0.05],
        occipital: [0.25, 0.02, -0.65],
        talamo: [0.12, 0.02, -0.05],
        basales: [0.23, 0.05, 0.02],
        hipocampo: [0.18, -0.10, -0.08],
        amigdala: [0.20, -0.14, 0.10]
    };

    // Perfect pre-calculated viewing direction vectors (pointing from target to camera)
    const viewDirections = {
        frontal: new THREE.Vector3(0.63, 0.47, 0.63),
        prefrontal: new THREE.Vector3(0.5, 0.25, 0.83),
        parietal: new THREE.Vector3(0.53, 0.76, -0.38),
        temporal: new THREE.Vector3(0.98, 0.0, 0.20),
        occipital: new THREE.Vector3(0.56, 0.16, -0.80),
        talamo: new THREE.Vector3(0.74, 0.37, 0.56),
        basales: new THREE.Vector3(0.83, 0.46, 0.37),
        hipocampo: new THREE.Vector3(0.78, -0.20, -0.59),
        amigdala: new THREE.Vector3(0.77, -0.29, 0.58)
    };

    const t = targets[id];
    if (t) {
        const sideSign = side === 'left' ? -1 : 1;
        targetControlsTarget.set(t[0] * sideSign, t[1], t[2]);

        const isSubcort = brainData[id] && brainData[id].tag !== 'Corteza Cerebral';
        const zoomDistance = isSubcort ? 1.6 : 2.5;

        // Dynamic zoom limit
        controls.minDistance = isSubcort ? 1.1 : 2.0;

        // Use the perfect viewing direction and mirror X for left side
        const dir = viewDirections[id].clone();
        dir.x *= sideSign;
        dir.normalize();

        targetCameraPosition.copy(targetControlsTarget).addScaledVector(dir, zoomDistance);
        isTransitioning = true;
    }
}

// ─── UI ────────────────────────────────────────────────────────────────────
function updateDetailsCard(id) {
    const d = brainData[id]; if (!d) return;
    document.getElementById('detail-tag').innerText = d.tag.toUpperCase();
    document.getElementById('detail-tag').style.backgroundColor = d.color;
    document.getElementById('detail-title').innerText = d.title;
    document.getElementById('detail-desc').innerHTML = d.desc;
    document.getElementById('detail-learning').innerHTML = d.learning;
    
    const imgEl = document.getElementById('detail-image');
    if (imgEl) {
        if (d.image) {
            imgEl.src = d.image;
            imgEl.classList.remove('hidden');
        } else {
            imgEl.classList.add('hidden');
        }
    }
    
    document.getElementById('details-card').classList.remove('hidden');
}

function updateSidebarList(id) {
    document.querySelectorAll('.structure-item').forEach(i => {
        i.classList.toggle('active', i.getAttribute('data-structure') === id);
    });
}

function setupUIEventListeners() {
    // Corte Sagital
    document.getElementById('btn-split').addEventListener('click', function() {
        isSplit = !isSplit;
        this.classList.toggle('active', isSplit);
        if (isSplit && autoRotateActive) document.getElementById('btn-rotate').click();
    });

    // Giro Automático
    document.getElementById('btn-rotate').addEventListener('click', function() {
        autoRotateActive = !autoRotateActive;
        this.classList.toggle('active', autoRotateActive);
    });

    // Vista General (Reset)
    document.getElementById('btn-global-view').addEventListener('click', () => {
        deselectAll();
        isSplit = false;
        document.getElementById('btn-split').classList.remove('active');
        if (!autoRotateActive) document.getElementById('btn-rotate').click();
    });

    // Click en cabecera Corteza → opacidad 100%
    document.getElementById('title-corteza').addEventListener('click', () => {
        deselectAll();
        currentCortexOpacity = 1.0;
        updateBaseOpacity();
        document.getElementById('title-corteza').classList.add('active');
        document.getElementById('btn-global-view').classList.remove('active');
    });

    // Click en cabecera Subcortical
    document.getElementById('title-subcorte').addEventListener('click', () => {
        deselectAll();
        currentCortexOpacity = 1.0;
        updateBaseOpacity();
        document.getElementById('title-subcorte').classList.add('active');
        document.getElementById('btn-global-view').classList.remove('active');
    });

    // Elementos del sidebar con click y hover sincronizados bidireccionales
    document.querySelectorAll('.structure-item').forEach(i => {
        const id = i.getAttribute('data-structure');
        i.addEventListener('click', () => selectStructure(id));

        i.addEventListener('mouseenter', () => {
            if (!selectedStructure) {
                hoveredStructure = id;
                highlightHover(id);
            }
        });
        i.addEventListener('mouseleave', () => {
            if (!selectedStructure) {
                hoveredStructure = null;
                resetMaterials();
            }
        });
    });

    // Botón cerrar detalles
    document.getElementById('btn-close-details').addEventListener('click', e => { e.stopPropagation(); deselectAll(); });

    // Slider de rotación manual
    const rotSlider = document.getElementById('rotation-slider');
    if (rotSlider) {
        rotSlider.addEventListener('input', function() {
            if (autoRotateActive) {
                autoRotateActive = false;
                document.getElementById('btn-rotate').classList.remove('active');
            }
            brainGroup.rotation.y = parseFloat(this.value);
        });
    }
}

function updateBaseOpacity() {
    cortexMeshes.forEach(m => {
        m.material.opacity = 1.0;
        m.material.transparent = false;
        m.material.depthWrite = true;
    });
    staticMeshes.forEach(m => {
        m.material.opacity = 1.0;
        m.material.transparent = false;
        m.material.depthWrite = true;
    });
}

// ─── RENDER LOOP ───────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    if (!modelLoaded) return;

    // Corte sagital
    const tL = isSplit ? -1.0 : 0, tR = isSplit ? 1.0 : 0;
    leftHemisphere.position.x  = THREE.MathUtils.lerp(leftHemisphere.position.x,  tL, 0.07);
    rightHemisphere.position.x = THREE.MathUtils.lerp(rightHemisphere.position.x, tR, 0.07);

    // Auto-rotación y sincronización de slider
    if (autoRotateActive && !selectedStructure) {
        brainGroup.rotation.y += 0.003;
        const rotSlider = document.getElementById('rotation-slider');
        if (rotSlider) {
            rotSlider.value = (brainGroup.rotation.y % (2 * Math.PI)).toFixed(2);
        }
    }

    // Transición de cámara fluida
    if (isTransitioning) {
        controls.target.lerp(targetControlsTarget, 0.08);
        camera.position.lerp(targetCameraPosition, 0.08);

        if (controls.target.distanceTo(targetControlsTarget) < 0.005 && camera.position.distanceTo(targetCameraPosition) < 0.005) {
            isTransitioning = false;
        }
    }

    // ── Opacity LERP — selección precisa por structureId ──
    if (selectedStructure) {
        const fId = selectedStructure;

        cortexMeshes.forEach(m => {
            const isSelected = m.userData.structureId === fId;
            const tEm = isSelected ? 0.45 : 0;

            if (isSelected && m.material.emissive) {
                m.material.emissive.copy(COLORS[fId] || new THREE.Color(0x60a5fa));
            }

            m.material.opacity = 1.0;
            m.material.emissiveIntensity = THREE.MathUtils.lerp(m.material.emissiveIntensity, tEm, 0.07);
            m.material.transparent = false;
            m.material.depthWrite = true;
        });

        staticMeshes.forEach(m => {
            m.material.opacity = 1.0;
            m.material.transparent = false;
            m.material.depthWrite = true;
        });

    } else {
        cortexMeshes.forEach(m => {
            m.material.opacity = 1.0;
            m.material.emissiveIntensity = THREE.MathUtils.lerp(m.material.emissiveIntensity, 0, 0.07);
            m.material.transparent = false;
            m.material.depthWrite = true;
        });
        staticMeshes.forEach(m => {
            m.material.opacity = 1.0;
            m.material.transparent = false;
            m.material.depthWrite = true;
        });
    }

    // ── Animación y Opacidad de Halos Subcorticales ──
    const time = performance.now() * 0.001;
    subcorticalHalos.forEach(halo => {
        const id = halo.userData.structureId;
        const isSelected = selectedStructure && (id === selectedStructure);
        const isHovered = hoveredStructure && (id === hoveredStructure) && !selectedStructure;

        let targetOpacity = 0.0;
        let targetScale = 1.0;

        if (isSelected) {
            targetOpacity = 0.65;
            targetScale = 1.0 + Math.sin(time * 5.0) * 0.12; // Pulso elegante
        } else if (isHovered) {
            targetOpacity = 0.40;
            targetScale = 1.05;
        }

        // LERP suave de opacidad y escala
        halo.material.opacity = THREE.MathUtils.lerp(halo.material.opacity, targetOpacity, 0.15);
        const s = THREE.MathUtils.lerp(halo.scale.x, targetScale, 0.15);
        halo.scale.set(s, s, s);
    });

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

function onWindowResize() {
    const c = document.getElementById('canvas-container');
    camera.aspect = c.clientWidth / c.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(c.clientWidth, c.clientHeight);
    labelRenderer.setSize(c.clientWidth, c.clientHeight);
}

window.addEventListener('DOMContentLoaded', init);
