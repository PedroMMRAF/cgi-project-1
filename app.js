import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from '../../libs/utils.js';
import { vec2, flatten } from '../../libs/MV.js';

// Buffers: particles before update, particles after update, quad vertices
let inParticlesBuffer, outParticlesBuffer, quadBuffer;

// Particle system constants
// Total number of particles
const N_PARTICLES = 100000;

const MAX_PLANETS = 10;
let planets = [];

let prevTime = undefined;

let flags = {
    drawPoints: true,
    drawField: true,
    setPlanet: false,
}

let uniforms = {
    // Automatic
    uScale: vec2(0.0, 0.0),
    uDeltaTime: 0.0,

    // User controllable
    uTvmin: 2.0,
    uTvmax: 10.0,
    uAlpha: 0.0,
    uBeta: Math.PI,
    uVmin: 0.1,
    uVmax: 0.2,
    uOrigin: vec2(0.0, 0.0)
}

function main(shaders) {
    // Generate the canvas element to fill the entire page
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const gl = setupWebGL(canvas, { alpha: true });

    // Initialize GLSL programs    
    const fieldProgram = buildProgramFromSources(gl, shaders["field-render.vert"],
        shaders["field-render.frag"]);
    const renderProgram = buildProgramFromSources(gl, shaders["particle-render.vert"],
        shaders["particle-render.frag"]);
    const updateProgram = buildProgramFromSources(gl, shaders["particle-update.vert"],
        shaders["particle-update.frag"], ["vPositionOut", "vAgeOut", "vLifeOut", "vVelocityOut"]);

    // This function is ran once at the start of the program
    // and everytime the canvas is resized
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        uniforms.uScale = vec2(1.5, 1.5 * canvas.height / canvas.width);
    }

    resizeCanvas();
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Enable Alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    buildQuad();
    buildParticleSystem(N_PARTICLES);

    window.addEventListener("resize", resizeCanvas);

    window.addEventListener("keydown", function (event) {
        switch (event.key) {
            case "PageUp":
                if (event.shiftKey)
                    uniforms.uVmin += 0.05;
                else
                    uniforms.uVmax += 0.05;
                break;
            case "PageDown":
                if (event.shiftKey)
                    uniforms.uVmin -= 0.05;
                else
                    uniforms.uVmax -= 0.05;
                break;
            case "ArrowUp":
                uniforms.uBeta += Math.PI / 36;
                uniforms.uBeta = Math.min(uniforms.uBeta, Math.PI);
                break;
            case "ArrowDown":
                uniforms.uBeta -= Math.PI / 36;
                uniforms.uBeta = Math.max(uniforms.uBeta, -Math.PI);
                break;
            case "ArrowLeft":
                uniforms.uAlpha += 0.1;
                break;
            case "ArrowRight":
                uniforms.uAlpha -= 0.1;
                break;
            case 'q':
                uniforms.uTvmin += 1;
                uniforms.uTvmin = Math.min(uniforms.uTvmin, 19);
                break;
            case 'a':
                uniforms.uTvmin -= 1;
                uniforms.uTvmin = Math.max(uniforms.uTvmin, 1);
                break;
            case 'w':
                uniforms.uTvmax += 1;
                uniforms.uTvmax = Math.min(uniforms.uTvmax, 20);
                break;
            case 's':
                uniforms.uTvmax -= 1;
                uniforms.uTvmax = Math.max(uniforms.uTvmax, 2);
                break;
            case '0':
                flags.drawField = !flags.drawField;
                break;
            case '9':
                flags.drawPoints = !flags.drawPoints;
                break;
        }
    })

    // Mouse buttons
    const LEFT_CLICK = 0;
    const RIGHT_BUTTON = 2;

    canvas.addEventListener("mousedown", function (event) {
        const cursor = getCursorPosition(event);

        // On right click, delete every planet the mouse is over
        // Don't do anything if a planet is currently being set
        if (!flags.setPlanet && event.button == RIGHT_BUTTON) {
            planets = planets.filter(planet => 
                distance(planet.position, cursor) > planet.radius)
        }

        // On left click, start creating a planet
        if (planets.length < MAX_PLANETS && event.button == LEFT_CLICK) {
            planets.push({ position: cursor, radius: 0.0 });
            flags.setPlanet = true;
        }
    });

    canvas.addEventListener("mousemove", function (event) {
        const cursor = getCursorPosition(event);

        // While a planet is being set, change it's radius
        if (flags.setPlanet) {
            let body = planets[planets.length - 1];
            body.radius = distance(body.position, cursor);
        }

        // Particle's origin point while the shift key is pressed
        if (event.shiftKey) {
            uniforms.uOrigin = cursor;
        }
    });

    canvas.addEventListener("mouseup", function (event) {
        // Finish setting any planet that might be being set
        flags.setPlanet = false;
    })

    // This event runs everytime the page's visibility changes
    // (such as when the window is minimized).
    document.addEventListener("visibilitychange", function (event) {
        // Resetting the prevTime will set uDeltaTime to 0 on the next
        // frame, preventing the particles from de-synchronizing
        prevTime = undefined;
    })

    // Euclidean distance between two points (or vectors)
    function distance(v1, v2) {
        const dx = v1[0] - v2[0];
        const dy = v1[1] - v2[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Mouse coordinates scaled by the desired canvas scale
    // (width between [-1.5, 1.5] while maintaining aspect ratio)
    function getCursorPosition(event) {
        const mx = event.offsetX;
        const my = event.offsetY;

        const x = ((mx / canvas.width * 2) - 1);
        const y = (((1 - my / canvas.height) * 2) - 1);

        return vec2(uniforms.uScale[0] * x, uniforms.uScale[1] * y);
    }

    // Creates a square that fills the canvas, used by the field.
    function buildQuad() {
        const vertices = [-1.0, 1.0, -1.0, -1.0, 1.0, -1.0,
        -1.0, 1.0, 1.0, -1.0, 1.0, 1.0];

        quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    }

    // Creates all of the particles with a set of initial conditions.
    function buildParticleSystem(nParticles) {
        const data = [];

        for (let i = 0; i < nParticles; ++i) {
            // Position (x, y)
            data.push(uniforms.uScale[0] * (Math.random() * 2 - 1));
            data.push(uniforms.uScale[1] * (Math.random() * 2 - 1));

            // Age
            data.push(0.0);

            // Life
            data.push(Math.random() * (uniforms.uTvmax - uniforms.uTvmin) + uniforms.uTvmin);

            // Velocity
            data.push(0.0);
            data.push(0.0);
        }

        // Particle buffers
        inParticlesBuffer = gl.createBuffer();
        outParticlesBuffer = gl.createBuffer();

        // Input buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, inParticlesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STREAM_DRAW);

        // Output buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, outParticlesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STREAM_DRAW);
    }

    // Loads every uniform onto the given program
    function loadUniforms(program) {
        // Iterate through every uniform name
        for (const name in uniforms) {
            // Get the uniform's value
            const value = uniforms[name];
            
            // See if the uniform is a vector and get it's length
            const vector = value instanceof Array ? "v" : "";
            const length = vector ? value.length : 1;

            // Send the uniform
            gl[`uniform${length}f${vector}`](
                gl.getUniformLocation(program, name), value)
        }
    }

    // Loads every planet uniform onto the given program
    function loadPlanetUniforms(program) {
        // Send the bodies' positions
        for (let i = 0; i < MAX_PLANETS; i++) {
            // Get the location of the uniforms...
            const uPosition = gl.getUniformLocation(program, `uPosition[${i}]`);
            const uRadius = gl.getUniformLocation(program, `uRadius[${i}]`);

            // Get the planet by index
            // If it doesn't exist, send dummy data since
            // deleting planets causes values to need to be reset
            const planet = planets[i] || {position: vec2(0, 0), radius: 0}

            // Send the corresponding values to the GLSL program
            gl.uniform2fv(uPosition, planet.position);
            gl.uniform1f(uRadius, planet.radius);
        }
    }

    function updateParticles() {
        gl.useProgram(updateProgram);

        loadUniforms(updateProgram);
        loadPlanetUniforms(updateProgram);

        // Setup attributes
        const vPosition = gl.getAttribLocation(updateProgram, "vPosition");
        const vAge = gl.getAttribLocation(updateProgram, "vAge");
        const vLife = gl.getAttribLocation(updateProgram, "vLife");
        const vVelocity = gl.getAttribLocation(updateProgram, "vVelocity");

        gl.bindBuffer(gl.ARRAY_BUFFER, inParticlesBuffer);

        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(vAge, 1, gl.FLOAT, false, 24, 8);
        gl.vertexAttribPointer(vLife, 1, gl.FLOAT, false, 24, 12);
        gl.vertexAttribPointer(vVelocity, 2, gl.FLOAT, false, 24, 16);

        gl.enableVertexAttribArray(vPosition);
        gl.enableVertexAttribArray(vAge);
        gl.enableVertexAttribArray(vLife);
        gl.enableVertexAttribArray(vVelocity);

        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, outParticlesBuffer);
        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, N_PARTICLES);
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    }

    function swapParticlesBuffers() {
        let auxBuffer = inParticlesBuffer;
        inParticlesBuffer = outParticlesBuffer;
        outParticlesBuffer = auxBuffer;
    }

    function drawQuad() {
        gl.useProgram(fieldProgram);

        loadUniforms(fieldProgram);
        loadPlanetUniforms(fieldProgram);

        // Setup attributes
        const vPosition = gl.getAttribLocation(fieldProgram, "vPosition");

        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.enableVertexAttribArray(vPosition);
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function drawParticles(nParticles) {
        gl.useProgram(renderProgram);

        loadUniforms(renderProgram);

        // Setup attributes
        const vPosition = gl.getAttribLocation(renderProgram, "vPosition");

        gl.bindBuffer(gl.ARRAY_BUFFER, outParticlesBuffer);

        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.drawArrays(gl.POINTS, 0, nParticles);
    }

    function animate(currTime) {
        // Time was in milliseconds, set it to be in seconds
        currTime /= 1000;

        // deltaTime is the difference of time between frames, in seconds,
        // except for the first frame, where that difference is 0
        uniforms.uDeltaTime = prevTime === undefined ? 0 : currTime - prevTime;

        // Set the previous time for the next frame
        prevTime = currTime;

        // Request next animation frame
        window.requestAnimationFrame(animate);

        // Clear framebuffer
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (flags.drawField) drawQuad();

        updateParticles();

        if (flags.drawPoints) drawParticles(N_PARTICLES);

        swapParticlesBuffers();
    }

    window.requestAnimationFrame(animate);
}


loadShadersFromURLS([
    "field-render.vert", "field-render.frag",
    "particle-update.vert", "particle-update.frag",
    "particle-render.vert", "particle-render.frag"
]).then(main);