export interface VertexBufferDescriptor {
    label: string;
    stride: number;
    stepMode: "vertex" | "instance";
    attributes: VertexAttribute[];
}

export interface UniformBufferDescriptor {
    label: string;
    attributes: UniformMember[];
    usage: "uniform" | "storage" | "read-only-storage";
    size: number;
}

export type VertexAttribute = {
    shaderLocation: number;
    format: GPUVertexFormat;
    offset: number;
};


export type UniformType = "f32" | "i32" | "u32" | "vec2f" | "vec3f" | "vec4f" | "mat4x4f";

export interface UniformMember {
    name: string;
    type: UniformType;
    // The Manager (or a Utility) calculates it based on WGSL rules.
    offset: number; 
}