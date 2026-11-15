// Unit model builders ported verbatim from ref/kingdom-wars-v2-10unit.html (prototype by the user).
// Changes: THREE is imported as a module, builders are exported, and createLoftedMesh resamples rings with fewer segments.
/* eslint-disable */
import * as THREE from "three";

// ============================================================================
// 1. PROCEDURAL UV TEXTURE ATLAS GENERATOR (Sama Persis Gambar Referensi)
// ============================================================================
let currentPrimaryColor = '#9e2b25'; // Crimson Red dari gambar referensi
let currentCrestColor = '#e2e4e6';   // Putih/Perak singa heraldik

function drawLionRampant(ctx, cx, cy, scale, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Kepala, Jambul & Mulut Mengaum
    ctx.beginPath();
    ctx.arc(-2, -22, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-12, -26, 8, 6);
    ctx.beginPath();
    ctx.moveTo(4, -29); ctx.lineTo(12, -23); ctx.lineTo(5, -16);
    ctx.fill();

    // Badan Singa Melengkung (Rampant Torso)
    ctx.beginPath();
    ctx.moveTo(-5, -16);
    ctx.quadraticCurveTo(12, -14, 9, 0);
    ctx.quadraticCurveTo(5, 13, -7, 17);
    ctx.quadraticCurveTo(-13, 8, -7, -2);
    ctx.closePath();
    ctx.fill();

    // Cakar Depan Atas & Bawah
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-4, -13); ctx.lineTo(-19, -23); ctx.lineTo(-24, -18);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-5, -5); ctx.lineTo(-20, -4); ctx.lineTo(-24, -8);
    ctx.stroke();

    // Kaki Belakang Kiri & Kanan
    ctx.beginPath();
    ctx.moveTo(-5, 13); ctx.lineTo(-17, 27); ctx.lineTo(-23, 27);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(3, 12); ctx.lineTo(14, 26); ctx.lineTo(8, 28);
    ctx.stroke();

    // Ekor Heraldik Melengkung S ke Atas
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(5, 10);
    ctx.bezierCurveTo(25, 8, 14, -22, 23, -26);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(23, -26, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function updateUVAtlasCanvas() {
    const canvas = document.getElementById('uv-atlas-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = '#1b1a1c';
    ctx.fillRect(0, 0, W, H);

    // 1. Kiri Atas: Tunik Merah + Singa Putih + Sabuk Kulit + Belahan Rok
    ctx.fillStyle = currentPrimaryColor;
    ctx.fillRect(8, 8, 88, 122);
    ctx.fillStyle = '#2d2520';
    ctx.beginPath();
    ctx.moveTo(38, 8); ctx.lineTo(52, 22); ctx.lineTo(66, 8);
    ctx.fill();
    drawLionRampant(ctx, 52, 52, 0.82, currentCrestColor);
    ctx.fillStyle = '#3b2618';
    ctx.fillRect(8, 88, 88, 11);
    ctx.strokeStyle = '#a88448';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(45, 87, 14, 13);
    ctx.fillStyle = '#1b1a1c';
    ctx.fillRect(49, 102, 6, 28);

    // 2. Tengah Atas: Unwrap Kulit Wajah & Tangan
    ctx.fillStyle = '#dba06d';
    ctx.fillRect(104, 10, 32, 46);
    ctx.fillStyle = '#c68b59';
    ctx.fillRect(104, 62, 32, 26);

    // 3. Kanan Atas: Unwrap Kettle Helmet Besi
    const helmGrad = ctx.createLinearGradient(144, 10, 208, 90);
    helmGrad.addColorStop(0, '#9699a1');
    helmGrad.addColorStop(1, '#55575c');
    ctx.fillStyle = helmGrad;
    ctx.beginPath();
    ctx.moveTo(176, 10);
    ctx.lineTo(208, 32);
    ctx.lineTo(208, 90);
    ctx.lineTo(144, 90);
    ctx.lineTo(144, 32);
    ctx.closePath();
    ctx.fill();

    // 4. Tengah Bawah: Mata Tombak & Sepatu Boot Kulit
    ctx.fillStyle = '#878991';
    ctx.beginPath();
    ctx.moveTo(118, 96); ctx.lineTo(134, 138); ctx.lineTo(102, 138);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#7c4d2b';
    ctx.fillRect(86, 156, 52, 50);

    // 5. Kiri Bawah: Celana Charcoal Gelap
    ctx.fillStyle = '#3b3738';
    ctx.fillRect(10, 140, 66, 66);

    // 6. Kanan Bawah: Heater Shield Perempat Merah-Putih
    ctx.save();
    ctx.translate(176, 155);
    ctx.fillStyle = '#8b8d94';
    ctx.beginPath();
    ctx.moveTo(-30, -45);
    ctx.lineTo(30, -45);
    ctx.lineTo(30, 0);
    ctx.quadraticCurveTo(28, 34, 0, 52);
    ctx.quadraticCurveTo(-28, 34, -30, 0);
    ctx.closePath();
    ctx.fill();

    ctx.clip();
    ctx.fillStyle = currentCrestColor;
    ctx.fillRect(-25, -39, 25, 41);
    ctx.fillRect(0, 2, 25, 48);
    ctx.fillStyle = currentPrimaryColor;
    ctx.fillRect(0, -39, 25, 41);
    ctx.fillRect(-25, 2, 25, 48);
    ctx.restore();
}

const chestTexCache = {};
function getChestHeraldicTexture(primaryHex, crestHex) {
    const key = `${primaryHex}_${crestHex}`;
    if (chestTexCache[key]) return chestTexCache[key];
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 256, 256);
    drawLionRampant(ctx, 128, 130, 2.35, crestHex);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    chestTexCache[key] = tex;
    return tex;
}

const shieldTexCache = {};
function getShieldQuarteredTexture(primaryHex, crestHex) {
    const key = `${primaryHex}_${crestHex}`;
    if (shieldTexCache[key]) return shieldTexCache[key];
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = crestHex;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);
    ctx.fillStyle = primaryHex;
    ctx.fillRect(128, 0, 128, 128);
    ctx.fillRect(0, 128, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    shieldTexCache[key] = tex;
    return tex;
}

// ============================================================================
// 2. LOFTED LOW-POLY MESH SCULPTOR (`createLoftedMesh` & `makeRing`)
// ============================================================================
function createLoftedMesh(rings, material, closeTop = true, closeBottom = true) {
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];
    const segs = rings[0].pts.length;

    for (let r = 0; r < rings.length; r++) {
        const y = rings[r].y;
        const v = r / (rings.length - 1);
        for (let s = 0; s <= segs; s++) {
            const ringPts = rings[r].pts; const pt = ringPts[Math.floor((s % segs) * ringPts.length / segs)]; // EMPIRE fix: rings may have fewer segments (wizard hat)
            positions.push(pt[0], y, pt[1]);
            uvs.push(s / segs, v);
        }
    }

    const rowStride = segs + 1;
    for (let r = 0; r < rings.length - 1; r++) {
        for (let s = 0; s < segs; s++) {
            const a = r * rowStride + s;
            const b = (r + 1) * rowStride + s;
            const c = (r + 1) * rowStride + (s + 1);
            const d = r * rowStride + (s + 1);
            indices.push(a, b, d);
            indices.push(b, c, d);
        }
    }

    if (closeBottom) {
        const centerIdx = positions.length / 3;
        positions.push(0, rings[0].y, 0);
        uvs.push(0.5, 0);
        for (let s = 0; s < segs; s++) {
            indices.push(centerIdx, s + 1, s);
        }
    }
    if (closeTop) {
        const topRingStart = (rings.length - 1) * rowStride;
        const centerIdx = positions.length / 3;
        positions.push(0, rings[rings.length - 1].y, 0);
        uvs.push(0.5, 1);
        for (let s = 0; s < segs; s++) {
            indices.push(centerIdx, topRingStart + s, topRingStart + s + 1);
        }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function makeRing(y, rx, rz, segs = 8, ox = 0, oz = 0, flattenFront = false) {
    const pts = [];
    for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        let x = Math.cos(a) * rx + ox;
        let z = Math.sin(a) * rz + oz;
        if (flattenFront && z > rz * 0.54) z = rz * 0.57;
        pts.push([x, z]);
    }
    return { y, pts };
}

// ============================================================================
// 3. PEMBANGUN 10 KARAKTER LOW-POLY (HUMANOID, CAVALRY, GOLEM, NAGA, DEMON)
// ============================================================================
const UNIT_DESCRIPTIONS = {
    spearman: 'Helm Kettle 10-segmen, wajah faceless tegas, tunik singa heraldik, sepatu boot kulit berlipat, tombak berlian & Heater Shield (~536 Tris).',
    swordsman: 'Great Helm ksatria dengan salib emas & jambul bulu (plume), pelindung bahu baja (pauldrons), pedang Broadsword & Heater Shield.',
    archer: 'Tudung lancip Robin Hood, tas panah (quiver) berisi bulu panah di punggung, sepatu boot ringan & busur melengkung Longbow.',
    wizard: 'Topi penyihir lebar melengkung (Wizard Hat), janggut putih poligonal, jubah panjang berkerah tinggi, & tongkat kristal api menyala.',
    paladin: 'Helm mahkota suci bersayap emas, jubah belakang kerajaan, cincin cahaya Halo mengambang, & palu perang dua tangan (Holy Warhammer).',
    necromancer: 'Tudung bayangan bertanduk gelap, jubah undead, tongkat kristal ungu, & 3 tengkorak menyala yang berputar mengorbit di sekitar tubuh.',
    cavalry: 'Ksatria berkuda lengkap: Kuda perang low-poly 4 kaki berartikulasi, baju zirah kain kuda (barding), pelindung kepala kuda & tombak Lance.',
    golem: 'Raksasa batu & besi asimetris: Dada super lebar dengan inti magma berdenyut, kepala bertanduk besi, cerobong punggung & tinju batu besar.',
    dragon: 'Naga Wyvern Merah low-poly: Kepala bertanduk dengan moncong api, leher S-curve, 2 sayap kelelawar lebar berartikulasi, 4 kaki cakar & ekor berduri.',
    demon: 'Raja Iblis Level 10: Tubuh V-shape kekar berlapis zirah hitam-emas, 4 tanduk mahkota melengkung, sayap iblis, & pedang raksasa Magma Greatsword.'
};

// Builder Khusus 1: Runic Iron Golem
function buildGolemCharacter(primaryColor, crestColor) {
    const root = new THREE.Group();
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x57534e, flatShading: true });
    const darkIronMat = new THREE.MeshLambertMaterial({ color: 0x334155, flatShading: true });
    const factionMat = new THREE.MeshLambertMaterial({ color: primaryColor, flatShading: true });
    const magmaMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfacc15, flatShading: true });

    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 1.65;
    root.add(torsoGroup);

    const golemTorso = createLoftedMesh([
        makeRing(0.0, 0.48, 0.36, 8),
        makeRing(0.45, 0.72, 0.48, 8),
        makeRing(1.05, 0.88, 0.55, 8),
        makeRing(1.38, 0.62, 0.44, 8)
    ], stoneMat);
    torsoGroup.add(golemTorso);

    const belt = createLoftedMesh([
        makeRing(-0.12, 0.52, 0.40, 8),
        makeRing(0.08, 0.52, 0.40, 8)
    ], darkIronMat);
    torsoGroup.add(belt);

    const loincloth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.65, 0.12), factionMat);
    loincloth.position.set(0, -0.32, 0.38);
    torsoGroup.add(loincloth);

    const coreRing = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 8), darkIronMat);
    coreRing.rotation.x = Math.PI / 2;
    coreRing.position.set(0, 0.75, 0.48);
    const magmaCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), magmaMat);
    magmaCore.position.set(0, 0.75, 0.52);
    torsoGroup.add(coreRing, magmaCore);

    for (let side of [-1, 1]) {
        const vent = createLoftedMesh([
            makeRing(0.95, 0.14, 0.14, 6, side * 0.38, -0.35),
            makeRing(1.55, 0.18, 0.18, 6, side * 0.44, -0.42)
        ], darkIronMat);
        torsoGroup.add(vent);
    }

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.32, 0.18);
    torsoGroup.add(headGroup);

    const headMesh = createLoftedMesh([
        makeRing(0.0, 0.28, 0.28, 6),
        makeRing(0.35, 0.32, 0.30, 6, 0, 0, true),
        makeRing(0.58, 0.24, 0.24, 6)
    ], darkIronMat);
    headGroup.add(headMesh);

    const visorGlow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.08), magmaMat);
    visorGlow.position.set(0, 0.34, 0.26);
    headGroup.add(visorGlow);

    const limbs = {};
    for (let side of [-1, 1]) {
        const armPivot = new THREE.Group();
        armPivot.position.set(side * 0.88, 1.15, 0);
        torsoGroup.add(armPivot);

        const pauldron = createLoftedMesh([
            makeRing(-0.05, 0.34, 0.34, 6, side * 0.08, 0),
            makeRing(0.28, 0.28, 0.28, 6, side * 0.04, 0)
        ], factionMat);
        armPivot.add(pauldron);

        const upperArm = createLoftedMesh([
            makeRing(0.0, 0.22, 0.22, 6),
            makeRing(-0.55, 0.20, 0.20, 6),
            makeRing(-0.65, 0.32, 0.32, 6),
            makeRing(-1.25, 0.38, 0.38, 6),
            makeRing(-1.48, 0.28, 0.28, 6)
        ], stoneMat);
        armPivot.add(upperArm);

        const runeBand = createLoftedMesh([
            makeRing(-0.68, 0.34, 0.34, 6),
            makeRing(-0.82, 0.36, 0.36, 6)
        ], goldMat);
        armPivot.add(runeBand);

        if (side === -1) limbs.rightArm = armPivot;
        else limbs.leftArm = armPivot;
    }

    for (let side of [-1, 1]) {
        const legPivot = new THREE.Group();
        legPivot.position.set(side * 0.34, 1.55, 0);
        root.add(legPivot);

        const legMesh = createLoftedMesh([
            makeRing(0.0, 0.25, 0.26, 6),
            makeRing(-0.75, 0.28, 0.28, 6),
            makeRing(-1.35, 0.34, 0.38, 6, 0, 0.05),
            makeRing(-1.55, 0.36, 0.42, 6, 0, 0.08)
        ], stoneMat);
        legPivot.add(legMesh);

        if (side === -1) limbs.rightLeg = legPivot;
        else limbs.leftLeg = legPivot;
    }

    root.userData = { limbs, torsoGroup, headGroup, magmaCore, unitType: 'golem', isCustomRig: true };
    return root;
}

// Builder Khusus 2: Ancient Red Dragon
function buildDragonCharacter(primaryColor, crestColor) {
    const root = new THREE.Group();
    const scaleMat = new THREE.MeshLambertMaterial({ color: primaryColor, flatShading: true });
    const bellyMat = new THREE.MeshLambertMaterial({ color: 0xd97706, flatShading: true });
    const wingMembraneMat = new THREE.MeshLambertMaterial({ color: 0x451a1c, flatShading: true, side: THREE.DoubleSide });
    const hornMat = new THREE.MeshLambertMaterial({ color: 0x1e1b18, flatShading: true });
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    const bodyGroup = new THREE.Group();
    bodyGroup.position.set(0, 2.05, 0);
    root.add(bodyGroup);

    const torsoMesh = createLoftedMesh([
        makeRing(-1.25, 0.18, 0.18, 8, 0, 0),
        makeRing(-0.55, 0.42, 0.38, 8, 0, 0.05),
        makeRing(0.25, 0.52, 0.46, 8, 0, 0.12),
        makeRing(0.75, 0.32, 0.30, 8, 0, 0.25)
    ], scaleMat);
    torsoMesh.rotation.x = Math.PI / 2;
    bodyGroup.add(torsoMesh);

    const bellyMesh = createLoftedMesh([
        makeRing(-0.85, 0.12, 0.10, 6, 0, -0.22),
        makeRing(0.15, 0.36, 0.16, 6, 0, -0.36),
        makeRing(0.65, 0.22, 0.12, 6, 0, -0.22)
    ], bellyMat);
    bellyMesh.rotation.x = Math.PI / 2;
    bodyGroup.add(bellyMesh);

    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, 0.25, 0.68);
    bodyGroup.add(neckGroup);

    const neckMesh = createLoftedMesh([
        makeRing(0.0, 0.28, 0.28, 6, 0, 0),
        makeRing(0.45, 0.22, 0.24, 6, 0, 0.18),
        makeRing(0.85, 0.20, 0.22, 6, 0, 0.42)
    ], scaleMat);
    neckGroup.add(neckMesh);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.88, 0.48);
    neckGroup.add(headGroup);

    const snout = createLoftedMesh([
        makeRing(-0.15, 0.26, 0.24, 6),
        makeRing(0.25, 0.22, 0.18, 6),
        makeRing(0.72, 0.12, 0.11, 6)
    ], scaleMat);
    snout.rotation.x = Math.PI / 2 + 0.22;
    headGroup.add(snout);

    for (let side of [-1, 1]) {
        const horn = createLoftedMesh([
            makeRing(0.0, 0.07, 0.07, 5, side * 0.16, 0),
            makeRing(0.35, 0.04, 0.04, 5, side * 0.24, -0.15),
            makeRing(0.68, 0.005, 0.005, 5, side * 0.30, -0.35)
        ], hornMat);
        horn.rotation.x = -0.55;
        headGroup.add(horn);
    }

    const fireBreath = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.65, 6), fireMat);
    fireBreath.rotation.x = -Math.PI / 2 - 0.25;
    fireBreath.position.set(0, -0.18, 0.85);
    headGroup.add(fireBreath);

    const tailMesh = createLoftedMesh([
        makeRing(0.0, 0.20, 0.20, 6, 0, 0),
        makeRing(-0.85, 0.13, 0.13, 6, 0, -0.12),
        makeRing(-1.75, 0.06, 0.06, 6, 0, -0.05),
        makeRing(-2.25, 0.01, 0.01, 6, 0, 0.05)
    ], scaleMat);
    tailMesh.rotation.x = Math.PI / 2;
    tailMesh.position.set(0, 0.02, -1.15);
    bodyGroup.add(tailMesh);

    for (let i = 0; i < 6; i++) {
        const spine = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 4), hornMat);
        spine.position.set(0, 0.45 - i * 0.04, 0.45 - i * 0.35);
        spine.rotation.x = -0.3;
        bodyGroup.add(spine);
    }

    const limbs = {};
    for (let side of [-1, 1]) {
        const wingPivot = new THREE.Group();
        wingPivot.position.set(side * 0.42, 0.32, 0.15);
        bodyGroup.add(wingPivot);

        const bone1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.35, 5), scaleMat);
        bone1.rotation.z = side * (-Math.PI / 2 + 0.28);
        bone1.position.set(side * 0.62, 0.18, 0);
        wingPivot.add(bone1);

        const bone2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.25, 5), scaleMat);
        bone2.rotation.z = side * (-Math.PI / 2 - 0.18);
        bone2.position.set(side * 1.75, 0.16, -0.1);
        wingPivot.add(bone2);

        const wShape = new THREE.Shape();
        wShape.moveTo(0, 0);
        wShape.lineTo(side * 1.25, 0.35);
        wShape.lineTo(side * 2.35, 0.02);
        wShape.lineTo(side * 1.85, -0.75);
        wShape.lineTo(side * 0.95, -0.65);
        wShape.lineTo(0, -0.85);
        wShape.closePath();

        const membrane = new THREE.Mesh(new THREE.ShapeGeometry(wShape), wingMembraneMat);
        membrane.rotation.x = Math.PI / 2 - 0.15;
        wingPivot.add(membrane);

        if (side === -1) limbs.rightArm = wingPivot;
        else limbs.leftArm = wingPivot;
    }

    for (let side of [-1, 1]) {
        const legPivot = new THREE.Group();
        legPivot.position.set(side * 0.38, -0.22, -0.35);
        bodyGroup.add(legPivot);

        const legMesh = createLoftedMesh([
            makeRing(0.0, 0.16, 0.18, 5),
            makeRing(-0.45, 0.12, 0.14, 5, 0, -0.1),
            makeRing(-0.85, 0.15, 0.22, 5, 0, 0.08)
        ], scaleMat);
        legPivot.add(legMesh);

        if (side === -1) limbs.rightLeg = legPivot;
        else limbs.leftLeg = legPivot;
    }

    const shadowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(1.15, 16),
        new THREE.MeshBasicMaterial({ color: 0x09090b, transparent: true, opacity: 0.45 })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    root.add(shadowDisc);

    root.userData = { limbs, torsoGroup: bodyGroup, headGroup, unitType: 'dragon', isCustomRig: true, isFlying: true };
    return root;
}

// Builder Khusus 3: Heavy Cavalry
function buildCavalryCharacter(primaryColor, crestColor) {
    const root = new THREE.Group();
    const horseSkinMat = new THREE.MeshLambertMaterial({ color: 0x5c3a21, flatShading: true });
    const bardingMat = new THREE.MeshLambertMaterial({ color: primaryColor, flatShading: true });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x878991, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfacc15, flatShading: true });

    const horseGroup = new THREE.Group();
    horseGroup.position.y = 1.15;
    root.add(horseGroup);

    const horseBody = createLoftedMesh([
        makeRing(-0.75, 0.34, 0.36, 8),
        makeRing(0.0, 0.42, 0.42, 8),
        makeRing(0.75, 0.38, 0.40, 8)
    ], bardingMat);
    horseBody.rotation.x = Math.PI / 2;
    horseGroup.add(horseBody);

    const neckMesh = createLoftedMesh([
        makeRing(0.0, 0.26, 0.28, 6, 0, 0.55),
        makeRing(0.65, 0.20, 0.24, 6, 0, 0.85),
        makeRing(0.95, 0.16, 0.20, 6, 0, 0.95)
    ], horseSkinMat);
    horseGroup.add(neckMesh);

    const horseHead = createLoftedMesh([
        makeRing(0.0, 0.18, 0.20, 6),
        makeRing(0.48, 0.12, 0.14, 6)
    ], steelMat);
    horseHead.position.set(0, 0.88, 0.95);
    horseHead.rotation.x = Math.PI / 2 + 0.35;
    horseGroup.add(horseHead);

    const limbs = {};
    const legPositions = [
        [-0.26, 0.55, 'rightLeg'],
        [0.26, 0.55, 'leftLeg'],
        [-0.26, -0.55, 'backRightLeg'],
        [0.26, -0.55, 'backLeftLeg']
    ];
    legPositions.forEach(([lx, lz, key]) => {
        const legPivot = new THREE.Group();
        legPivot.position.set(lx, -0.1, lz);
        horseGroup.add(legPivot);

        const legMesh = createLoftedMesh([
            makeRing(0.0, 0.13, 0.14, 6),
            makeRing(-0.55, 0.09, 0.10, 6),
            makeRing(-1.05, 0.11, 0.13, 6)
        ], horseSkinMat);
        legPivot.add(legMesh);
        limbs[key] = legPivot;
    });

    const rider = buildHumanoidCharacter('swordsman', primaryColor, crestColor);
    rider.scale.setScalar(0.76);
    rider.position.set(0, -0.25, -0.05);
    rider.userData.limbs.rightLeg.rotation.z = -0.55;
    rider.userData.limbs.leftLeg.rotation.z = 0.55;

    const riderWeapon = rider.userData.weaponGroup;
    riderWeapon.clear();
    const lance = createLoftedMesh([
        makeRing(0.0, 0.06, 0.06, 6),
        makeRing(0.35, 0.22, 0.22, 6),
        makeRing(0.42, 0.12, 0.12, 6),
        makeRing(3.45, 0.01, 0.01, 6)
    ], goldMat);
    lance.rotation.x = Math.PI / 2 - 0.15;
    riderWeapon.add(lance);

    horseGroup.add(rider);
    limbs.rightArm = rider.userData.limbs.rightArm;
    limbs.leftArm = rider.userData.limbs.leftArm;

    root.userData = { limbs, torsoGroup: horseGroup, headGroup: rider.userData.headGroup, weaponGroup: riderWeapon, unitType: 'cavalry', isCustomRig: true };
    return root;
}

// Builder Utama Humanoid (Spearman, Heavy Knight, Longbow, Fire Wizard, Paladin, Necromancer, Demon Lord)
function buildHumanoidCharacter(unitType = 'spearman', primaryColor = currentPrimaryColor, crestColor = currentCrestColor) {
    const root = new THREE.Group();
    const isDemon = unitType === 'demon';
    const isNecro = unitType === 'necromancer';
    const isWizard = unitType === 'wizard';
    const isPaladin = unitType === 'paladin';

    const mats = {
        tunic: new THREE.MeshLambertMaterial({ color: isNecro ? 0x1e1b2e : (isDemon ? 0x18181b : primaryColor), flatShading: true }),
        tunicChest: new THREE.MeshLambertMaterial({ map: getChestHeraldicTexture(isNecro ? '#1e1b2e' : (isDemon ? '#18181b' : primaryColor), isDemon ? '#ef4444' : crestColor), flatShading: true }),
        sleeve: new THREE.MeshLambertMaterial({ color: isPaladin ? 0xd4d4d8 : (isDemon ? 0x7f1d1d : 0x7b797e), flatShading: true }),
        skin: new THREE.MeshLambertMaterial({ color: isDemon ? 0x991b1b : (isNecro ? 0x94a3b8 : 0xdba06d), flatShading: true }),
        hair: new THREE.MeshLambertMaterial({ color: isWizard ? 0xe2e8f0 : 0x3b281e, flatShading: true }),
        leatherBelt: new THREE.MeshLambertMaterial({ color: 0x3d2618, flatShading: true }),
        brass: new THREE.MeshLambertMaterial({ color: 0xa88448, flatShading: true }),
        pants: new THREE.MeshLambertMaterial({ color: 0x3b3738, flatShading: true }),
        boots: new THREE.MeshLambertMaterial({ color: isPaladin ? 0xa16207 : 0x7c4d2b, flatShading: true }),
        steel: new THREE.MeshLambertMaterial({ color: 0x878991, flatShading: true }),
        wood: new THREE.MeshLambertMaterial({ color: 0x7a4b2a, flatShading: true }),
        gold: new THREE.MeshLambertMaterial({ color: 0xfacc15, flatShading: true }),
        glowFire: new THREE.MeshBasicMaterial({ color: 0xff5500 }),
        glowNecro: new THREE.MeshBasicMaterial({ color: 0xa855f7 }),
        glowHoly: new THREE.MeshBasicMaterial({ color: 0xfef08a })
    };

    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 1.85;
    root.add(torsoGroup);

    const shoulderWidth = isDemon ? 0.62 : 0.47;
    const upperTorso = createLoftedMesh([
        makeRing(0.0, 0.37, 0.24, 8),
        makeRing(0.45, isDemon ? 0.52 : 0.43, 0.27, 8),
        makeRing(0.88, shoulderWidth, 0.26, 8),
        makeRing(0.96, 0.22, 0.19, 8)
    ], mats.tunic);
    torsoGroup.add(upperTorso);

    const chestDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.62, 1, 1), mats.tunicChest);
    chestDecal.position.set(0, 0.49, 0.266);
    chestDecal.rotation.x = -0.04;
    torsoGroup.add(chestDecal);

    const neckRing = createLoftedMesh([
        makeRing(0.93, 0.23, 0.20, 8),
        makeRing(1.03, 0.18, 0.17, 8)
    ], mats.sleeve);
    torsoGroup.add(neckRing);

    const beltMesh = createLoftedMesh([
        makeRing(-0.06, 0.385, 0.255, 8),
        makeRing(0.07, 0.385, 0.255, 8)
    ], mats.leatherBelt);
    torsoGroup.add(beltMesh);

    const buckleGroup = new THREE.Group();
    buckleGroup.position.set(0, 0.005, 0.262);
    const bTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), mats.brass);
    bTop.position.y = 0.055;
    const bBot = bTop.clone(); bBot.position.y = -0.055;
    const bL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), mats.brass);
    bL.position.x = -0.065;
    const bR = bL.clone(); bR.position.x = 0.065;
    buckleGroup.add(bTop, bBot, bL, bR);
    torsoGroup.add(buckleGroup);

    if (isWizard || isNecro) {
        const robeSkirt = createLoftedMesh([
            makeRing(0.0, 0.38, 0.26, 8),
            makeRing(-0.65, 0.48, 0.34, 8),
            makeRing(-1.35, 0.58, 0.42, 8)
        ], mats.tunic);
        torsoGroup.add(robeSkirt);
    } else {
        for (let side of [-1, 1]) {
            const skirtFlap = createLoftedMesh([
                makeRing(0.0, 0.185, 0.24, 6, side * 0.19, 0),
                makeRing(-0.28, 0.21, 0.255, 6, side * 0.21, 0),
                makeRing(-0.56, 0.23, 0.27, 6, side * 0.23, 0)
            ], mats.tunic);
            torsoGroup.add(skirtFlap);
        }
    }

    if (unitType === 'swordsman' || isPaladin || isDemon) {
        for (let side of [-1, 1]) {
            const pauldron = createLoftedMesh([
                makeRing(0.72, 0.22, 0.22, 6, side * (shoulderWidth - 0.02), 0),
                makeRing(0.95, 0.16, 0.18, 6, side * (shoulderWidth - 0.06), 0)
            ], isPaladin ? mats.gold : mats.steel);
            torsoGroup.add(pauldron);
        }
    }

    if (isPaladin) {
        const cape = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.48, 0.06), mats.gold);
        cape.position.set(0, 0.18, -0.28);
        cape.rotation.x = 0.12;
        torsoGroup.add(cape);
    } else if (isDemon) {
        for (let side of [-1, 1]) {
            const wingShape = new THREE.Shape();
            wingShape.moveTo(0, 0);
            wingShape.lineTo(side * 1.15, 0.75);
            wingShape.lineTo(side * 1.55, 0.15);
            wingShape.lineTo(side * 0.95, -0.65);
            wingShape.closePath();
            const dWing = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), new THREE.MeshLambertMaterial({ color: 0x450a0a, side: THREE.DoubleSide, flatShading: true }));
            dWing.position.set(side * 0.2, 0.65, -0.28);
            dWing.rotation.y = -side * 0.35;
            torsoGroup.add(dWing);
        }
    }

    let orbitGroup = null;
    if (isNecro) {
        orbitGroup = new THREE.Group();
        orbitGroup.position.set(0, 0.55, 0);
        torsoGroup.add(orbitGroup);
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const skull = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), mats.glowNecro);
            skull.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85);
            orbitGroup.add(skull);
        }
    }

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.02, 0);
    torsoGroup.add(headGroup);

    const headMesh = createLoftedMesh([
        makeRing(0.0, 0.14, 0.14, 8),
        makeRing(0.12, 0.15, 0.15, 8, 0, 0.02),
        makeRing(0.18, 0.22, 0.23, 8, 0, 0.04, true),
        makeRing(0.42, 0.27, 0.28, 8, 0, 0.02, true),
        makeRing(0.68, 0.26, 0.28, 8, 0, 0.0, true),
        makeRing(0.82, 0.16, 0.18, 8)
    ], mats.skin);
    headGroup.add(headMesh);

    const hairMesh = createLoftedMesh([
        makeRing(0.16, 0.21, 0.18, 6, 0, -0.09),
        makeRing(0.35, 0.27, 0.22, 6, 0, -0.08),
        makeRing(0.58, 0.28, 0.23, 6, 0, -0.06)
    ], mats.hair);
    headGroup.add(hairMesh);

    if (unitType === 'spearman') {
        const kettleHelm = createLoftedMesh([
            makeRing(0.49, 0.50, 0.53, 10, 0, -0.01),
            makeRing(0.63, 0.33, 0.35, 10, 0, -0.01),
            makeRing(0.84, 0.29, 0.31, 10, 0, -0.01),
            makeRing(1.01, 0.15, 0.16, 10, 0, -0.01),
            makeRing(1.10, 0.01, 0.01, 10, 0, -0.01)
        ], mats.steel, true, false);
        kettleHelm.rotation.x = -0.06;
        headGroup.add(kettleHelm);
    } else if (unitType === 'swordsman') {
        const greatHelm = createLoftedMesh([
            makeRing(0.18, 0.29, 0.30, 8),
            makeRing(0.82, 0.30, 0.31, 8),
            makeRing(0.95, 0.24, 0.25, 8)
        ], mats.steel);
        const visorV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.04), mats.gold);
        visorV.position.set(0, 0.52, 0.30);
        const visorH = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.04), mats.gold);
        visorH.position.set(0, 0.58, 0.30);
        const plume = createLoftedMesh([
            makeRing(0.92, 0.08, 0.14, 6, 0, 0),
            makeRing(1.22, 0.12, 0.28, 6, 0, -0.08),
            makeRing(1.35, 0.04, 0.18, 6, 0, -0.18)
        ], mats.tunic);
        headGroup.add(greatHelm, visorV, visorH, plume);
    } else if (unitType === 'archer') {
        const hood = createLoftedMesh([
            makeRing(0.14, 0.31, 0.31, 8),
            makeRing(0.55, 0.31, 0.34, 8, 0, -0.03),
            makeRing(0.88, 0.18, 0.32, 8, 0, -0.14),
            makeRing(0.96, 0.04, 0.10, 8, 0, -0.28)
        ], mats.tunic);
        headGroup.add(hood);
    } else if (isWizard) {
        const beard = createLoftedMesh([
            makeRing(-0.22, 0.04, 0.04, 5, 0, 0.22),
            makeRing(0.05, 0.16, 0.14, 5, 0, 0.20),
            makeRing(0.28, 0.22, 0.16, 5, 0, 0.16)
        ], mats.hair);
        const wizHat = createLoftedMesh([
            makeRing(0.55, 0.62, 0.62, 10),
            makeRing(0.65, 0.30, 0.30, 10),
            makeRing(1.05, 0.18, 0.18, 8, 0, -0.06),
            makeRing(1.42, 0.08, 0.08, 8, 0, -0.22),
            makeRing(1.62, 0.01, 0.01, 6, 0, -0.38)
        ], mats.tunic);
        headGroup.add(beard, wizHat);
    } else if (isPaladin) {
        const crown = createLoftedMesh([
            makeRing(0.56, 0.29, 0.30, 8),
            makeRing(0.84, 0.33, 0.34, 8)
        ], mats.gold);
        const halo = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 16), mats.glowHoly);
        halo.material.side = THREE.DoubleSide;
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 1.12;
        headGroup.add(crown, halo);
    } else if (isNecro || isDemon) {
        const darkHelm = createLoftedMesh([
            makeRing(0.25, 0.30, 0.31, 8),
            makeRing(0.78, 0.28, 0.30, 8)
        ], mats.tunic);
        headGroup.add(darkHelm);
        for (let side of [-1, 1]) {
            const horn = createLoftedMesh([
                makeRing(0.62, 0.08, 0.08, 6, side * 0.22, 0),
                makeRing(0.95, 0.06, 0.06, 6, side * 0.38, 0.06),
                makeRing(1.28, 0.01, 0.01, 6, side * 0.28, 0.18)
            ], isDemon ? mats.gold : mats.steel);
            headGroup.add(horn);
        }
    }

    const limbs = {};
    for (let side of [-1, 1]) {
        const isRight = side === -1;
        const armPivot = new THREE.Group();
        armPivot.position.set(side * (shoulderWidth + 0.01), 0.80, 0);
        torsoGroup.add(armPivot);

        const sleeveMesh = createLoftedMesh([
            makeRing(0.05, 0.15, 0.15, 6),
            makeRing(-0.35, 0.13, 0.13, 6),
            makeRing(-0.68, 0.11, 0.11, 6),
            makeRing(-0.70, 0.14, 0.14, 6),
            makeRing(-0.82, 0.13, 0.13, 6)
        ], mats.sleeve);
        armPivot.add(sleeveMesh);

        const handGroup = new THREE.Group();
        handGroup.position.set(0, -0.84, 0);
        armPivot.add(handGroup);

        const palm = createLoftedMesh([
            makeRing(0.0, 0.095, 0.10, 6),
            makeRing(-0.14, 0.105, 0.11, 6),
            makeRing(-0.24, 0.085, 0.08, 6)
        ], mats.skin);
        handGroup.add(palm);

        const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.07), mats.skin);
        thumb.position.set(-side * 0.08, -0.10, 0.06);
        thumb.rotation.z = side * 0.4;
        handGroup.add(thumb);

        if (isRight) limbs.rightArm = armPivot;
        else limbs.leftArm = armPivot;
    }

    for (let side of [-1, 1]) {
        const legPivot = new THREE.Group();
        legPivot.position.set(side * 0.20, 1.45, 0);
        root.add(legPivot);

        const pantsMesh = createLoftedMesh([
            makeRing(0.0, 0.165, 0.175, 6),
            makeRing(-0.42, 0.14, 0.15, 6),
            makeRing(-0.72, 0.12, 0.13, 6)
        ], mats.pants);
        legPivot.add(pantsMesh);

        const bootShaft = createLoftedMesh([
            makeRing(-0.68, 0.155, 0.165, 6),
            makeRing(-0.82, 0.14, 0.15, 6),
            makeRing(-1.26, 0.12, 0.135, 6),
            makeRing(-1.42, 0.135, 0.16, 6)
        ], mats.boots);
        legPivot.add(bootShaft);

        const bootFoot = createLoftedMesh([
            makeRing(-1.28, 0.125, 0.14, 6, 0, 0.02),
            makeRing(-1.36, 0.14, 0.24, 6, 0, 0.10),
            makeRing(-1.45, 0.135, 0.25, 6, 0, 0.11)
        ], mats.boots);
        legPivot.add(bootFoot);

        if (side === -1) limbs.rightLeg = legPivot;
        else limbs.leftLeg = legPivot;
    }

    const weaponGroup = new THREE.Group();
    weaponGroup.position.set(0, -0.14, 0.05);
    limbs.rightArm.children[1].add(weaponGroup);

    if (unitType === 'spearman') {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 3.7, 6), mats.wood);
        shaft.position.y = 0.75;
        const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.22, 6), mats.steel);
        socket.position.y = 2.65;
        const spearTip = createLoftedMesh([
            makeRing(2.74, 0.05, 0.03, 4),
            makeRing(2.92, 0.18, 0.055, 4),
            makeRing(3.48, 0.005, 0.005, 4)
        ], mats.steel);
        spearTip.rotation.y = Math.PI / 4;
        weaponGroup.add(shaft, socket, spearTip);
    } else if (unitType === 'swordsman' || isDemon) {
        const bladeScale = isDemon ? 1.45 : 1.0;
        const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), mats.leatherBelt);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.44 * bladeScale, 0.07, 0.10), mats.gold);
        guard.position.y = 0.20;
        const blade = createLoftedMesh([
            makeRing(0.22, 0.10 * bladeScale, 0.03, 4),
            makeRing(1.45 * bladeScale, 0.08 * bladeScale, 0.025, 4),
            makeRing(1.75 * bladeScale, 0.005, 0.005, 4)
        ], isDemon ? mats.glowFire : mats.steel);
        blade.rotation.y = Math.PI / 4;
        weaponGroup.add(hilt, guard, blade);
        weaponGroup.rotation.x = Math.PI / 2.2;
    } else if (unitType === 'archer') {
        const bowArc = createLoftedMesh([
            makeRing(-0.75, 0.02, 0.02, 5, 0, -0.14),
            makeRing(-0.35, 0.035, 0.035, 5, 0, 0.04),
            makeRing(0.0, 0.04, 0.04, 5, 0, 0.10),
            makeRing(0.35, 0.035, 0.035, 5, 0, 0.04),
            makeRing(0.75, 0.02, 0.02, 5, 0, -0.14)
        ], mats.wood);
        const bowString = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.48, 4), mats.sleeve);
        bowString.position.z = -0.13;
        weaponGroup.add(bowArc, bowString);
        weaponGroup.rotation.x = Math.PI / 2;

        const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.65, 6), mats.boots);
        quiver.position.set(0.18, 0.45, -0.28);
        quiver.rotation.z = -0.28;
        torsoGroup.add(quiver);
    } else if (isWizard || isNecro) {
        const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 2.85, 6), mats.wood);
        staff.position.y = 0.55;
        const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 8), mats.gold);
        crownRing.position.y = 2.08;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), isNecro ? mats.glowNecro : mats.glowFire);
        crystal.position.y = 2.12;
        weaponGroup.add(staff, crownRing, crystal);
    } else if (isPaladin) {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 2.4, 6), mats.wood);
        shaft.position.y = 0.55;
        const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.28), mats.gold);
        hammerHead.position.y = 1.72;
        weaponGroup.add(shaft, hammerHead);
    }

    let shieldGroup = null;
    if (unitType === 'spearman' || unitType === 'swordsman' || isPaladin) {
        shieldGroup = new THREE.Group();
        shieldGroup.position.set(0.12, -0.05, 0.12);
        shieldGroup.rotation.y = 0.35;
        limbs.leftArm.children[1].add(shieldGroup);

        const shieldShape = new THREE.Shape();
        shieldShape.moveTo(-0.42, 0.52);
        shieldShape.lineTo(0.42, 0.52);
        shieldShape.lineTo(0.42, 0.02);
        shieldShape.quadraticCurveTo(0.38, -0.45, 0.0, -0.68);
        shieldShape.quadraticCurveTo(-0.38, -0.45, -0.42, 0.02);
        shieldShape.closePath();

        const rimExtrude = new THREE.ExtrudeGeometry(shieldShape, { depth: 0.06, bevelEnabled: false, curveSegments: 4 });
        const shieldRim = new THREE.Mesh(rimExtrude, isPaladin ? mats.gold : mats.steel);
        shieldRim.castShadow = true;
        shieldGroup.add(shieldRim);

        const innerShape = new THREE.Shape();
        innerShape.moveTo(-0.35, 0.45);
        innerShape.lineTo(0.35, 0.45);
        innerShape.lineTo(0.35, 0.02);
        innerShape.quadraticCurveTo(0.31, -0.38, 0.0, -0.58);
        innerShape.quadraticCurveTo(-0.31, -0.38, -0.35, 0.02);
        innerShape.closePath();

        const faceGeom = new THREE.ShapeGeometry(innerShape, 4);
        const posAttr = faceGeom.attributes.position;
        const uvAttr = faceGeom.attributes.uv;
        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            uvAttr.setXY(i, (vx + 0.35) / 0.70, (vy + 0.50) / 0.95);
        }
        const shieldFace = new THREE.Mesh(faceGeom, new THREE.MeshLambertMaterial({
            map: getShieldQuarteredTexture(primaryColor, crestColor),
            flatShading: true
        }));
        shieldFace.position.z = 0.063;
        shieldGroup.add(shieldFace);
    }

    root.userData = { limbs, torsoGroup, headGroup, weaponGroup, shieldGroup, orbitGroup, unitType };
    return root;
}

function buildReferenceSoldier(unitType = 'spearman', primaryColor = currentPrimaryColor, crestColor = currentCrestColor) {
    if (unitType === 'golem') return buildGolemCharacter(primaryColor, crestColor);
    if (unitType === 'dragon') return buildDragonCharacter(primaryColor, crestColor);
    if (unitType === 'cavalry') return buildCavalryCharacter(primaryColor, crestColor);
    return buildHumanoidCharacter(unitType, primaryColor, crestColor);
}


export { buildReferenceSoldier, UNIT_DESCRIPTIONS };
