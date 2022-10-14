precision highp float;

// Constants
const float G = 6.67e-11; // Gravitational constant
const float RHO = 5.51e3; // Planet density
const float RE = 6.371e6; // Scale factor
const float M1 = 1.0;     // Particle mass (Kg)
const float PI = 3.141592653589793; // PI

// Planets
const int MAX_PLANETS = 10;
uniform float uRadius[MAX_PLANETS];
uniform vec2 uPosition[MAX_PLANETS];

varying vec2 position;

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

void main() {
    vec2 force = netForce(position);
    float f = length(force);
    
    float hue = atan(force.y, force.x) / (2.0 * PI);
    vec3 color = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    
    float alpha = clamp(f, 0.0, 1.0) * step(mod(log(f) / 2.0, 0.4), 0.35);

    gl_FragColor = vec4(color, alpha);
}