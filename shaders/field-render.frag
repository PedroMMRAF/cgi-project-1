precision highp float;

// Canvas size
uniform vec2 uResolution;
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

vec3 hueColor(float hue) {
    return clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

void main() {
    vec2 pos = gl_FragCoord.xy / uResolution;
    pos = (pos * 2.0 - 1.0) * uScale;

    vec2 force = netForce(pos);
    float p = length(force);
    float alpha = clamp(p, 0.0, 1.0) * step(mod(log(p), 0.6), 0.5);

    gl_FragColor = vec4(hueColor(atan(force.y, force.x) / (2.0 * PI)), alpha);
}