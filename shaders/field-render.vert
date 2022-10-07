precision mediump float;

// Vertex position in World Coordinates
attribute vec2 vPosition;

varying vec2 position;

void main() 
{
    position = vPosition;
    gl_Position = vec4(vPosition, 0.0, 1.0);
}