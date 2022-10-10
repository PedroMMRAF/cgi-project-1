import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from '../../libs/utils.js';
import { vec2, flatten, subtract, dot } from '../../libs/MV.js';

// Buffers: particles before update, particles after update, quad vertices
let inParticlesBuffer, outParticlesBuffer, quadBuffer;

// Particle system constants

// Total number of particles
const N_PARTICLES = 100000;

let time = undefined;
let mousePosition = [0.0, 0.0];

let flags = {
    drawPoints: true,
    drawField:  true,
    setPlanet: false,
}

let userConstants = {
    uTvmin: 2.0,
    uTvmax: 10.0,
    uAlpha: 0.0,
    uBeta: Math.PI,
    uVmin: 0.1,
    uVmax: 0.2,
    uOrigin: [0.0, 0.0]
}

const MAX_PLANETS = 10;
let planets = [];

function main(shaders)
{
    // Generate the canvas element to fill the entire page
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    
    canvas.width =  window.innerWidth;
    canvas.height = window.innerHeight;
    

    /** type {WebGL2RenderingContext} */
    const gl = setupWebGL(canvas, {alpha: true});

    // Initialize GLSL programs    
    const fieldProgram = buildProgramFromSources(gl, shaders["field-render.vert"], shaders["field-render.frag"]);
    const renderProgram = buildProgramFromSources(gl, shaders["particle-render.vert"], shaders["particle-render.frag"]);
    const updateProgram = buildProgramFromSources(gl, shaders["particle-update.vert"], shaders["particle-update.frag"], ["vPositionOut", "vAgeOut", "vLifeOut", "vVelocityOut"]);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Enable Alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); 

    buildQuad();
    buildParticleSystem(N_PARTICLES);

    window.addEventListener("resize", function(event) {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    });

    window.addEventListener("keydown", function(event) {
        // TODO: Implement user constants
        switch(event.key) {
            case "PageUp":
                break;
            case "PageDown":
                break;
            case "ArrowUp":
                break;
            case "ArrowDown":
                break;
            case "ArrowLeft":
                break;
            case "ArrowRight":
                break;
            case 'q':
                break;
            case 'a':
                break;
            case 'w':
                break;
            case 's':
                break;
            case '0':
                flags.drawField = !flags.drawField;
                break;
            case '9':
                flags.drawPoints  = !flags.drawPoints;
                break; 
            case 'Shift':
                break;
        }
    })
    
    canvas.addEventListener("mousedown", function(event) {
        if (planets.length < MAX_PLANETS) {
            planets.push({position: mousePosition, radius: 0.0});
            flags.setPlanet = true;
        }
    });

    canvas.addEventListener("mousemove", function(event) {
        const mx = event.offsetX;
        const my = event.offsetY;

        const x = ((mx / canvas.width * 2) - 1);
        const y = (((1 - my / canvas.height) * 2) -1);
        
        const [w, h] = squaringRatios();

        mousePosition = vec2(x * w, y * h);

        if (flags.setPlanet) {
            let body = planets[planets.length - 1];
            let [bx, by] = body.position;
            let [mx, my] = mousePosition;
            let dx = mx - bx;
            let dy = my - by;
            body.radius = Math.sqrt(dx * dx + dy * dy);
        }

        if (event.shiftKey) {
            userConstants.uOrigin = mousePosition;
        }
    });

    canvas.addEventListener("mouseup", function(event) {
        flags.setPlanet = false;
    })

    document.addEventListener("visibilitychange", function() {
        // When the page is tabbed out or reopened, reset time.
        // Since the page is not running, time will only update
        // once back to the page, which will update deltaTime.
        // This does not fix physics breaking caused by lag
        time = undefined;
    })

    function squaringRatios() {
        return [1.5, 1.5 * canvas.height / canvas.width];
    }

    function buildQuad() {
        const vertices = [-1.0, 1.0, -1.0, -1.0, 1.0, -1.0,
                          -1.0, 1.0,  1.0, -1.0, 1.0,  1.0];
        
        quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    }

    function buildParticleSystem(nParticles) {
        const data = [];

        let [w, h] = squaringRatios();

        for(let i = 0; i < nParticles; ++i) {
            // position
            const x = Math.random() * w * 2 - w;
            const y = Math.random() * h * 2 - h;

            data.push(x); data.push(y);
            
            // age
            data.push(0.0);

            // life
            data.push(Math.random() * 8.0 + 2.0);

            // velocity
            data.push(0.0);
            data.push(0.0);
        }

        inParticlesBuffer = gl.createBuffer();
        outParticlesBuffer = gl.createBuffer();

        // Input buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, inParticlesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STREAM_DRAW);

        // Output buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, outParticlesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STREAM_DRAW);
    }

    function sendCommonUniforms(prog) {
        const uScale = gl.getUniformLocation(prog, "uScale");
        gl.uniform2fv(uScale, squaringRatios());

        for (let unif in userConstants) {
            let value = [userConstants[unif]].flat()
            gl[`uniform${value.length}fv`](
                gl.getUniformLocation(prog, unif), value)
        }
    }

    function sendPlanetUniforms(prog) {
        sendCommonUniforms(prog);

        // Send the bodies' positions
        for(let i = 0; i < planets.length; i++) {
            // Get the location of the uniforms...
            const uPosition = gl.getUniformLocation(prog, `uPosition[${i}]`);
            const uRadius = gl.getUniformLocation(prog, `uRadius[${i}]`);

            // Send the corresponding values to the GLSL program
            gl.uniform2fv(uPosition, planets[i].position);
            gl.uniform1f(uRadius, planets[i].radius);
        }
    }

    function updateParticles(deltaTime)
    {
        gl.useProgram(updateProgram);
        
        // Setup uniforms
        const uDeltaTime = gl.getUniformLocation(updateProgram, "uDeltaTime");
        gl.uniform1f(uDeltaTime, deltaTime);

        sendPlanetUniforms(updateProgram);
        
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

    function swapParticlesBuffers()
    {
        let auxBuffer = inParticlesBuffer;
        inParticlesBuffer = outParticlesBuffer;
        outParticlesBuffer = auxBuffer;
    }

    function drawQuad() {
        gl.useProgram(fieldProgram);

        sendPlanetUniforms(fieldProgram);

        // Setup attributes
        const vPosition = gl.getAttribLocation(fieldProgram, "vPosition"); 

        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.enableVertexAttribArray(vPosition);
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function drawParticles(buffer, nParticles)
    {
        gl.useProgram(renderProgram);

        sendCommonUniforms(renderProgram);

        // Setup attributes
        const vPosition = gl.getAttribLocation(renderProgram, "vPosition");

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.drawArrays(gl.POINTS, 0, nParticles);
    }

    function animate(timestamp)
    {
        let deltaTime = 0;

        if(time === undefined) {        // First time
            time = timestamp / 1000;
            deltaTime = 0;
        } 
        else {                          // All other times
            deltaTime = timestamp / 1000 - time;
            time = timestamp / 1000;
        }

        // Request next animation frame
        window.requestAnimationFrame(animate);

        // Clear framebuffer
        gl.clear(gl.COLOR_BUFFER_BIT);

        if(flags.drawField) drawQuad();

        updateParticles(deltaTime);
        
        if(flags.drawPoints) drawParticles(outParticlesBuffer, N_PARTICLES);

        swapParticlesBuffers();
    }

    window.requestAnimationFrame(animate);
}


loadShadersFromURLS([
    "field-render.vert", "field-render.frag",
    "particle-update.vert", "particle-update.frag", 
    "particle-render.vert", "particle-render.frag"
]).then(main);