precision mediump float;

// Number of seconds (possibly fractional) that has passed since the last update step.
uniform float uDeltaTime;

// Canvas uniform
uniform vec2 uScale;

// Constants
const float G = 6.67e-11; // Gravitational constant
const float RHO = 5.51e3; // Planet density
const float RE = 6.371e6; // Scale factor
const float M1 = 1.0;     // Particle mass (Kg)
const float PI = 3.141592653589793; // PI

// TODO: User defined constants

// Planets
const int MAX_PLANETS = 10;
uniform float uRadius[MAX_PLANETS];
uniform vec2 uPosition[MAX_PLANETS];

vec2 netForce(vec2 pos) {
    vec2 totalForce = vec2(0.0);

    for (int i = 0; i < MAX_PLANETS; i++) {
        vec2 dist = uPosition[i] - pos;
        float radius = uRadius[i];
        
        if (radius > 0.0)
            totalForce += normalize(dist) * radius * radius * radius / dot(dist, dist);
    }

    return M1 * G * RE * (4.0 * PI * RHO / 3.0) * totalForce;
}

// Inputs. These reflect the state of a single particle before the update.
attribute vec2 vPosition;              // actual position
attribute float vAge;                  // actual age (in seconds)
attribute float vLife;                 // when it is supposed to die 
attribute vec2 vVelocity;              // actual speed

// Outputs. These mirror the inputs.
// These values will be captured into our transform feedback buffer!
varying vec2 vPositionOut;
varying float vAgeOut;
varying float vLifeOut;
varying vec2 vVelocityOut;

// generates a pseudo random number that is a function of the argument.
// The argument needs to be constantly changing from call to call to generate different results
highp float rand(vec2 co) {
    highp float a  = 12.9898;
    highp float b  = 78.233;
    highp float c  = 43758.5453;
    highp float dt = dot(co.xy, vec2(a,b));
    highp float sn = mod(dt, PI);
    return fract(sin(sn) * c);
}

void main() {
    // Update parameters according to our simple rules.
    vPositionOut = vPosition + vVelocity * uDeltaTime;
    vAgeOut = vAge + uDeltaTime;
    vLifeOut = vLife;
    vVelocityOut = vVelocity + (netForce(vPosition) / M1) * uDeltaTime;
        
    if (vAgeOut >= vLife) {
        vLifeOut = rand(vec2(vAge, vLife)) * 8.0 + 2.0;
        vAgeOut = 0.0;

        const float alpha = 0.0;
        const float beta = PI;
        const float vmin = 0.1;
        const float vmax = 0.2;

        float angle = alpha + (rand(vPositionOut) * 2.0 - 1.0) * beta;
        float vel = rand(vVelocityOut) * (vmax - vmin) + vmin;

        vVelocityOut = vec2(cos(angle), sin(angle)) * vel;
        vPositionOut = vec2(0.0);
    }
}