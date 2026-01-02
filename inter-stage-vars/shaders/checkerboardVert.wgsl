struct UniformsScale {
    triangleScale: vec2f,
};

struct VertexData {
    @location(0) pos: vec2f,    // per vertex
    @location(1) col1: vec4f,   // per instance
    @location(2) col2: vec4f,   // per instance
    @location(3) offset: vec2f, // per instance
    @location(4) scale: vec2f,  // per instance
};
    
@group(0) @binding(0) var<uniform> uniformsScale : UniformsScale;

struct VertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) color1 : vec4f,
    @location(1) color2 : vec4f,
};

@vertex fn vs(
    vert: VertexData,
    @builtin(instance_index) instanceIndex: u32
) -> VertexShaderOutput {

    var vsOut: VertexShaderOutput;


    let posWorld = vert.pos 
                    * vert.scale 
                    * uniformsScale.triangleScale 
                    + vert.offset;

    vsOut.position = vec4f(posWorld, 0.0, 1.0); 
    vsOut.color1 = vert.col1;
    vsOut.color2 = vert.col2;
    
    return vsOut;
}