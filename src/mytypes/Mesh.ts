import { vec2, vec3, vec4 } from "gl-matrix";

export interface MeshData {
    v : vec2[] | vec3[] | vec4[];
    v_size() : number;

    f?: vec3[] | vec4[];
    f_size() : number;

    n?: vec2[] | vec3[] | vec4[];
    c?: vec4[]
}

