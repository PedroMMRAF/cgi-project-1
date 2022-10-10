precision mediump float;

// Canvas scale factor
uniform vec2 uScale;

// Vertex position in World Coordinates
attribute vec2 vPosition;

varying vec2 position;

void main()
{
    position = vPosition * uScale;
    gl_Position = vec4(vPosition, 0.0, 1.0);
}