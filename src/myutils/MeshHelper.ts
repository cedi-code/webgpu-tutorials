import { vec2, vec3, vec4 } from "gl-matrix"
import { MeshData } from "../mytypes"

const primitives = {
    square(s: number) : MeshData {
        return {
            v: [
                [s,s,s],      // RIGHT TOP
                [-s, -s,s],   // LEFT BOTTOM
                [s, -s,s],    // RIGHT BOTTOM
                [-s, s,s],    // LEFT TOP

            ],
            v_size : () => { return 4;},
            f: [
                [0,1,2],
                [0,3,1]
            ],
            f_size : () => { return 2; },
        }
    },

    cube(s: number) : MeshData {

        return {
            v: [
                [s, s, s],      // 0 RIGHT TOP FRONT
                [-s, -s, s],    // 1 LEFT BOTTOM FRONT 
                [s, -s, s],     // 2 RIGHT BOTTOM FRONT      
                [-s, s, s],     // 3 LEFT TOP FRONT

                [s, s, -s],      // 4 RIGHT TOP BACK
                [-s, -s, -s],    // 5 LEFT BOTTOM BACK 
                [s, -s, -s],     // 6 RIGHT BOTTOM BACK      
                [-s, s, -s],     // 7 LEFT TOP BACK


            ],
            v_size : () => { return 8;},
            f: [
                [0,1,2],
                [0,3,1], // front triangles

                [4,5,6],
                [4,7,5], // back triangles

                [4,2,6],
                [4,0,2], // right triangles

                [7,1,5],
                [7,3,1], // left triangles

                [4,3,0],
                [4,7,3], // top triangles

                [6,1,2],
                [6,5,1], // bottom triangles
            ],
            f_size : () => { return 12; },   
        }
    }

}

const meshHelper = {

    convertMeshToValues(data : MeshData, unitSize: number) : { v: Float32Array<ArrayBuffer>, f: Uint32Array<ArrayBuffer> } {
        
        // verticies
        const v = new Float32Array(unitSize * data.v_size());
        if(unitSize !== data.v[0].length) {
            throw Error("size missmatch of MeshData to Buffer");
        }
        let count = 0;
        data.v.forEach((vec) => {
            for(let i = 0; i < vec.length; ++i) {
                v[count] = vec[i];
                count++;
            }
        });

        const f = new Uint32Array(data.f_size() * data.f![0].length);
        count = 0;
        data.f?.forEach((face) => {
            for(let i = 0; i < face.length; ++i) {
                f[count] = face[i];
                count++;
            }
        });

        return { v, f };
    }
}

export { meshHelper, primitives };