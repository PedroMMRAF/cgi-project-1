precision mediump float;

varying float fLeft;

void main() {
    gl_FragColor = vec4(1.0, 1.0, 0.6, fLeft * 0.4);
}