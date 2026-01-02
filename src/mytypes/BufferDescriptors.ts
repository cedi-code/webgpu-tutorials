export interface VertexBufferDescriptor {
    label: string;
    unitSizeBytes: number;
    stepMode: "vertex" | "instance";
    attributes: VertexAttribute[];
}

export interface UniformBufferDescriptor {
    label: string;
    attributes: UniformMember[];
    usage: "uniform" | "storage";
    size: number;
}

export type VertexAttribute = {
    shaderLocation: number;
    name: string;
    format: GPUVertexFormat;
    offset: number;
};


export type UniformType = "f32" | "i32" | "u32" | "vec2f" | "vec3f" | "vec4f" | "mat4x4f" | "mat3x3f" | "mat2x2f" | "vec2i" | "vec3i" | "vec4i" | "vec2u" | "vec3u" | "vec4u";

export interface UniformMember {
    name: string;
    type: UniformType;
    // The Manager (or a Utility) calculates it based on WGSL rules.
    offsetBytes: number; 
}