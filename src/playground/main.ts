import { bufferManager, IndexBufferDescriptorBuilder, UniformBufferDescriptorBuilder, VertexBufferDescriptorBuilder } from '../myutils/BufferHelper.js';
import { meshHelper, primitives } from '../myutils/MeshHelper.js';

interface Uniforms {
    bufferMatricies: GPUBuffer,
    valuesMatricies: Float32Array<ArrayBuffer>,
    bufferGrid: GPUBuffer,
    valuesGrid: Uint32Array<ArrayBuffer>
}

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
    for(let colorAttachment of renderPassDescriptor.colorAttachments) {
        if(!colorAttachment) continue; 
        colorAttachment.view = context.getCurrentTexture().createView();
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

function rand(min : number = 0.0, max : number = 0.0) : number  {
    if(max <= min) {
        return Math.random() * min;
    }
    return Math.random() * (max - min) + min;
}

async function main() {


    const gpu = navigator.gpu;
    if(!gpu) {
        alert("browser needs WebGPU support");
        return;
    }

    const adapter = await gpu.requestAdapter();
    const device = await adapter?.requestDevice();
    if(!device) {
        alert("browser needs WebGPU support");
        return;
    }

    // get webgpu context from canvas
    const canvas = document.querySelector('canvas');
    if(!canvas) {
        console.error("could not find canvas html element");
        return;
    }

    const context = canvas?.getContext('webgpu');
    if(!context) {
        console.error("could not get webgpu context from canvas");
        return;
    }
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format: presentationFormat,
    });

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
        }
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

    const offNDC = uniformProjDesc.attributes[0].offset;    // to convert to screenspace
    const offFudge = uniformProjDesc.attributes[1].offset;     // projeciton matrix  (flatten the z axis)
    const offTM = uniformProjDesc.attributes[2].offset      // translation matrix 

    const near = 1.0;
    const far = 1000.0;

    uPValues[offNDC + 0] = 2.0 / (canvas.width);
    uPValues[offNDC + 5] = -2.0 / (canvas.height);
    uPValues[offNDC + 10] = 1 / (far - near); // normalize z to [0,1]; // scale z
    uPValues[offNDC + 12] = 0; // translate x
    uPValues[offNDC + 13] = 0; // translate y
    uPValues[offNDC + 14] = -near / (far - near); // translate the near value to 0
    uPValues[offNDC + 15] = 1.0;

    uPValues[offFudge + 0] = 2.0;

    uPValues[offTM + 0] = 1;
    uPValues[offTM + 5] = 1;
    uPValues[offTM + 10] = 1;
    uPValues[offTM + 12] = 100;
    uPValues[offTM + 15] = 1;
    

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
            uPValues[offNDC + 0] = 2.0 / (canvas.width);
            uPValues[offNDC + 5] = 2.0 / (canvas.height);

            device.queue.writeBuffer(uniformBufferProj,0, uPValues);
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
        
        uniforms.valuesMatricies[offTM + 14] = 100*scaleX;
        device.queue.writeBuffer(uniforms.bufferMatricies, 0, uniforms.valuesMatricies);
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    });

    scaleYSlider.addEventListener('input', () => {
        const scaleY : number =  parseFloat(scaleYSlider.value);
        uniforms.valuesMatricies[offFudge] = 2*scaleY;
        device.queue.writeBuffer(uniforms.bufferMatricies, 0, uniforms.valuesMatricies);
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    });

    // initial render
    render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    
}

main();
