import { mat4 } from 'gl-matrix';
import { bufferManager, IndexBufferDescriptorBuilder, UniformBufferDescriptorBuilder, VertexBufferDescriptorBuilder } from '../myutils/BufferHelper.js';
import { meshHelper, primitives } from '../myutils/MeshHelper.js';

interface Uniforms {
    bufferMatricies: GPUBuffer,
    valuesMatricies: Float32Array<ArrayBuffer>,
    bufferGrid: GPUBuffer,
    valuesGrid: Uint32Array<ArrayBuffer>
}

let depthTexture : GPUTexture | null = null;

function render(
    device : GPUDevice, 
    renderPassDescriptor : GPURenderPassDescriptor, 
    pipeline : GPURenderPipeline, 
    context : GPUCanvasContext,
    bindGroup: GPUBindGroup, 
    vertexBuffer: GPUBuffer,
    indexBuffer: GPUBuffer,
    instanceBuffer: GPUBuffer,
    numVert : number,
    numObjects : number
    ) {

    // get current textrure from canvas
    const canvasTexture = context.getCurrentTexture();

    for(let colorAttachment of renderPassDescriptor.colorAttachments) {
        if(!colorAttachment) continue; 
        colorAttachment.view = canvasTexture.createView();
    }
    if(renderPassDescriptor.depthStencilAttachment && depthTexture) {
        renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView();
    }

    const encoder = device.createCommandEncoder({ label: 'my first encoder'});

    // make a render pass
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, instanceBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(numVert, numObjects);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}



async function getwebgpucontext() : Promise<{ gpu : GPU, adapter: GPUAdapter, device: GPUDevice, canvas: HTMLCanvasElement, context: GPUCanvasContext, presentationFormat : GPUTextureFormat } | null> {
    const gpu = navigator.gpu;
    if(!gpu) {
        alert("browser needs WebGPU support");
        return null;
    }

    const adapter = await gpu.requestAdapter();
    if(!adapter) {
        alert("could not get gpu adapter");
        return null;
    }
    const device = await adapter?.requestDevice();
    if(!device) {
        alert("browser needs WebGPU support");
        return null;
    }

    // get webgpu context from canvas
    const canvas = document.querySelector('canvas');
    if(!canvas) {
        console.error("could not find canvas html element");
        return null;
    }

    const context = canvas?.getContext('webgpu');
    if(!context) {
        console.error("could not get webgpu context from canvas");
        return null;
    }
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format: presentationFormat,
    });

    return { gpu, adapter, device, canvas, context, presentationFormat };

}
function rand(min : number = 0.0, max : number = 0.0) : number  {
    if(max <= min) {
        return Math.random() * min;
    }
    return Math.random() * (max - min) + min;
}

async function main() {


    const webgpucontext = await getwebgpucontext();
    if(!webgpucontext) {
        return;
    }
    const { gpu, adapter, device, canvas, context, presentationFormat } = webgpucontext;


    const responseVert = await fetch('./shaders/simpleProjVert.wgsl');
    const shaderCodeVert = await responseVert.text();
    const responseFrag = await fetch('./shaders/checkerboardFrag.wgsl');
    const shaderCodeFrag = await responseFrag.text();

    const vsModule = device.createShaderModule({
        label: 'hardcoded checkerboard triangle vertex shader',
        code:  shaderCodeVert,
    });

    const fsModule = device.createShaderModule({
        label: 'hardcoded checkerboard triangle fragment shader',
        code: shaderCodeFrag,
    });

    const meshCube = primitives.cube(50);
    const numVerticies = meshCube.v_size();
    const triangleBufferBuilder = new VertexBufferDescriptorBuilder("Square Vertex Buffer", numVerticies, "vertex")
        .add(0, "position", "float32x3");

    const numObjects = 1;
    const instanceBufferBuilder = new VertexBufferDescriptorBuilder("Instance Buffer", numObjects, "instance")
        .add(1, "color1", "float32x4")
        .add(2, "color2", "float32x4")
        .add(3, "scale", "float32x2")
        .add(4, "offset", "float32x2");

    const pipeline = device.createRenderPipeline({
        label: 'hardcoded checkerboard triangle',
        layout: 'auto',
        vertex: {
            entryPoint: 'vs',
            module: vsModule,
            buffers: [
                triangleBufferBuilder.buildLayout(),
                instanceBufferBuilder.buildLayout(),
            ],
        },
        fragment: {
            entryPoint: 'fs',
            module: fsModule,
            targets: [{ format: presentationFormat }],
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        }
    });

    // creating texture
    depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });


    const renderPassDescriptor : GPURenderPassDescriptor= {
        label: 'basic renderpass',
        colorAttachments: [
            {
                clearValue: [0.3, 0.3, 0.3, 1.0],
                loadOp: 'clear',
                storeOp: 'store',
                view: context.getCurrentTexture().createView(),
            },
        ],
        depthStencilAttachment: {
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
            view: context.getCurrentTexture().createView(),
        }
    };

    bufferManager.init(device);
    // == UNIFORM STATIC BUFFER SETUP start ==

    /*
    struct UniformsScale {
        triangleScale: vec2f
    };
    */

    const uniformProjDesc = new UniformBufferDescriptorBuilder("uniforms for projection buffer")
        .add("ndc mat", "mat4x4f")
        .add("fudge val", "f32")
        .add("translation mat", "mat4x4f")
        .add("rotation mat", "mat4x4f")
        .build();
    const uniformBufferProj = bufferManager.createBuffer(uniformProjDesc);


    /*
    struct UniformGrid {
        gridScale: u32,
    };
    */
    const gridUniformBuilder = new UniformBufferDescriptorBuilder("Uniform Grid Buffer");
    gridUniformBuilder.add("gridScale", "u32");
    const gridUniformDesc = gridUniformBuilder.build();
    const uniformBufferGrid = bufferManager.createBuffer(gridUniformDesc);



    // values
    const uPValues = new Float32Array(uniformProjDesc.size);

    const offProj = uniformProjDesc.attributes[0].offset;    // to convert to screenspace
    const offFudge = uniformProjDesc.attributes[1].offset;     // projeciton matrix  (flatten the z axis)
    const offTM = uniformProjDesc.attributes[2].offset      // translation matrix 
    const offTMBytes = uniformProjDesc.attributes[2].offsetBytes;

    const near = 1.0;
    const far = 800.0;

    const perspectiveMat = uPValues.subarray(offProj, offProj+16);
    mat4.perspective(perspectiveMat, Math.PI/2, canvas.width/canvas.height, near, far);
    
    const transformMat = uPValues.subarray(offTM, offTM+16);

    mat4.identity(transformMat);
    mat4.translate(transformMat, transformMat, [0,0,-300]);
    
    device.queue.writeBuffer(uniformBufferProj,0, uPValues);

    const uniformGridValues = new Uint32Array(gridUniformDesc.size);
    const offsetG = gridUniformDesc.attributes[0].offset;
    uniformGridValues[offsetG] = 8;
    device.queue.writeBuffer(uniformBufferGrid, 0, uniformGridValues);

    const uniforms : Uniforms = {            
        bufferMatricies: uniformBufferProj,
        valuesMatricies: uPValues,
        bufferGrid: uniformBufferGrid,
        valuesGrid: uniformGridValues
    };

    // == UNIFORM BUFFER SETUP end ==
    /*
    struct VertexData {
        pos: vec2f
        color1: vec4f,
        color2: vec4f,
        offset: vec2f,
        objscale: vec2f,
    };
    */
    const instanceDesc = instanceBufferBuilder.build();
    const instanceBuffer = bufferManager.createBuffer(instanceDesc);

    // values
    const instanceValues = new Float32Array(instanceDesc.unitSize * numObjects);

    for(let i : number = 0; i < numObjects; ++i) {

        const currIndex : number = instanceDesc.unitSize * i;
        const attrib = instanceDesc.attributes;
        // values
        const kColor1Offset = currIndex + attrib[0].offset;
        const kColor2Offset = currIndex + attrib[1].offset;
        const kOffsetOffset = currIndex + attrib[2].offset;
        const kObjScaleOffset = currIndex + attrib[3].offset;

        instanceValues.set([rand(1),rand(1),0,1], kColor1Offset);
        instanceValues.set([rand(1),rand(1),0,1], kColor2Offset);
        instanceValues.set([rand(-0.9, 0.9),rand(-0.9, 0.9)],kOffsetOffset);
        const startScale = rand(0.1, 1.0);
        instanceValues.set([startScale, startScale], kObjScaleOffset);
        
    }
    device.queue.writeBuffer(instanceBuffer, 0, instanceValues);

    const triangleVBDesc = triangleBufferBuilder.build();
    const vertexBuffer = bufferManager.createBuffer(triangleVBDesc);


    const {v: vertexData , f: indexData} = meshHelper.convertMeshToValues(meshCube, triangleVBDesc.unitSize);

    device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const numIndicies = meshCube.f_size()*3;
    const indexBufferDesc = new IndexBufferDescriptorBuilder("Index Buffer", numIndicies, "uint32").build();
    const indexBuffer = bufferManager.createBuffer(indexBufferDesc);

    device.queue.writeBuffer(indexBuffer, 0, indexData);

    const bindGroup = device.createBindGroup({
        label: 'bind group checkerboard trees',
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBufferProj }},
            { binding: 1, resource: { buffer: uniformBufferGrid }},
        ]
    });


    // setup observer when canvas resizes
    const observer = new ResizeObserver(entries => {
        for(const entry of entries) {
            const canvas = (entry.target as HTMLCanvasElement);
            const width = entry.contentBoxSize[0].inlineSize;
            const height = entry.contentBoxSize[0].blockSize;
            canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
            canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
            
            mat4.perspective(perspectiveMat, Math.PI/2, canvas.width/canvas.height, near, far);

            if(!depthTexture || depthTexture.width !== canvas.width || depthTexture.height !== canvas.height) {
                if(depthTexture) {
                    depthTexture.destroy();
                }
                depthTexture = device.createTexture({
                        size: [width, height],
                        format: 'depth24plus',
                        usage: GPUTextureUsage.RENDER_ATTACHMENT
                });
            }

            device.queue.writeBuffer(uniformBufferProj,offProj * 4, uPValues);
        }
        render(device, renderPassDescriptor, pipeline, context,bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    });
    observer.observe(canvas);

    // setup sliders
    const checkerScaleSlider = document.getElementById('checkerScale') as HTMLInputElement;
    const scaleXSlider = document.getElementById('scaleX') as HTMLInputElement;
    const scaleYSlider = document.getElementById('scaleY') as HTMLInputElement;

    checkerScaleSlider.addEventListener('input', () => {
        const scaleGrid = parseInt(checkerScaleSlider.value);
        uniforms.valuesGrid[0] = scaleGrid;
        device.queue.writeBuffer(uniforms.bufferGrid, 0, uniforms.valuesGrid);
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    });

    scaleXSlider.addEventListener('input', () => {
        const scaleX : number = parseFloat(scaleXSlider.value);
        
        uniforms.valuesMatricies[offTM + 14] = -100*scaleX;
        device.queue.writeBuffer(uniforms.bufferMatricies, offTMBytes, uniforms.valuesMatricies, offTM, 16);
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    });

    let speed = 1.0;
    scaleYSlider.addEventListener('input', () => {
        const scaleY : number =  parseFloat(scaleYSlider.value);
        uniforms.valuesMatricies[offFudge] = 2*scaleY;
        speed = scaleY * 2;

    });

    const timeStep = 0.0016;
    function animate(time : number) {
        mat4.rotateY(transformMat,transformMat, speed*timeStep*Math.PI)
        device.queue.writeBuffer(uniforms.bufferMatricies,  offTMBytes, uniforms.valuesMatricies, offTM, 16);
        
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
        requestAnimationFrame(animate);

    }

    // initial render
    render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    
    requestAnimationFrame(animate);
}




export {
    render,
    getwebgpucontext,
}
