import { bufferManager, IndexBufferDescriptorBuilder, UniformBufferDescriptorBuilder, VertexBufferDescriptorBuilder } from '../myutils/BufferHelper.js';
import {render, getwebgpucontext} from './main.js';


console.log("== texture-test.js ==");

async function main() {
    const webgpucontext = await getwebgpucontext();
    if(!webgpucontext) {
        console.error("failed to get webgpu context");
        return;
    }
    const { gpu, adapter, device, canvas, context, presentationFormat } = webgpucontext;

    const responseVert = await fetch('shaders/texture-test-vert.wgsl');
    const responseFrag = await fetch('shaders/texture-test-frag.wgsl');
    const shaderTextVert = await responseVert.text();
    const shaderTextFrag = await responseFrag.text();

    const vsModule = device.createShaderModule({
        label: 'vertex shader texture test',
        code: shaderTextVert,
    });

    const fsModule = device.createShaderModule({
        label: 'fragment shader texture test',
        code: shaderTextFrag,
    });

    const trianglePlaneBufferBuilder = new VertexBufferDescriptorBuilder("Plane Vertex Buffer", 4, "vertex")
        .add(0, "position", "float32x3")
        .add(1, "uv", "float32x2");

    const pipeline = device.createRenderPipeline({
        label: 'texture test pipeline',
        layout: 'auto',
        vertex: {
            entryPoint: 'vs',
            module: vsModule,
            buffers: [
                trianglePlaneBufferBuilder.buildLayout()
            ],
        },
        fragment: {
            entryPoint: 'fs',
            module: fsModule,
            targets: [{ format: presentationFormat }],
        }
    });

    const renderPassDescriptor: GPURenderPassDescriptor = {
        label: 'basic pass',
        colorAttachments: [
            {
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
                view: context.getCurrentTexture().createView(),
            },
        ],
    };

    // == BUFFERS start ==
    bufferManager.init(device);

    const planeVBDesc = trianglePlaneBufferBuilder.build();
    const planeVertexBuffer = bufferManager.createBuffer(planeVBDesc);

    // value
    const vertexValues = new Float32Array([
        // position         uv
        -0.5, -0.5, 0,      0, 1, // bl
        0.5, -0.5, 0,       1, 1, // br
        -0.5, 0.5, 0,       0, 0, // tl
        0.5, 0.5, 0,        1, 0, // tr
    ]);
    device.queue.writeBuffer(planeVertexBuffer, 0, vertexValues);

    const indexBufferDesc = new IndexBufferDescriptorBuilder("index buffer plane", 6, "uint32").build();
    const indexBuffer = bufferManager.createBuffer(indexBufferDesc);

    const indexValues = new Uint32Array([
        0, 1, 2,
        3, 2, 1,
    ]);

    device.queue.writeBuffer(indexBuffer, 0, indexValues);

    const uniformBufferDesc = new UniformBufferDescriptorBuilder("uniforms", "uniform")
            .add("scale", "f32").build();
    const uniformBuffer = bufferManager.createBuffer(uniformBufferDesc);
    const uniformV = new Float32Array(uniformBufferDesc.size);
    const offScale = uniformBufferDesc.attributes[0].offset;
    uniformV[offScale] = 1.0;

    device.queue.writeBuffer(uniformBuffer, 0, uniformV);


    // == BUFFER end ==

    // == TEXTURE start ==

    // DATA
    const kTextureW = 5;
    const kTextureH = 7;
    const _ = [255,   0,   0, 255];  // red
    const y = [255, 255,   0, 255];  // yellow
    const b = [  0,   0, 255, 255];  // blue
    const textureData = new Uint8Array([
        b, _, _, _, _,
        _, y, y, y, _,
        _, y, _, _, _,
        _, y, y, _, _,
        _, y, _, _, _,
        _, y, _, _, _,
        _, _, _, _, _,
    ].flat());


    // texture
    const texture = device.createTexture({
        size: [kTextureW, kTextureH],
        format: 'rgba8unorm', // 8 bits unsigned int, norm = values will be normalized
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST, 
    });

    device.queue.writeTexture(
        { texture },
        textureData,
        { bytesPerRow: kTextureW * 4},
        { width: kTextureW, height: kTextureH },
    );

    // sampler
    const samplers = [
        device.createSampler({
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            magFilter: 'nearest',
            minFilter: 'nearest',
        }),
        device.createSampler({
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            magFilter: 'linear',
            minFilter: 'linear',
        }),
        device.createSampler({
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            magFilter: 'nearest',
            minFilter: 'nearest',
        }),
        device.createSampler({
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            magFilter: 'linear',
            minFilter: 'linear',
        }),
    ];


    // pass our sampler and texture to bind group
    const bindGroups : GPUBindGroup[] = [];
    for(let sampler of samplers) {
        const bindGroup = device.createBindGroup({
            label: 'bind group texture',
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: texture},
                { binding: 2, resource: { buffer: uniformBuffer } },
            ],
        });
        bindGroups.push(bindGroup);
    }

    const sliderScale = document.getElementById('checkerScale') as HTMLInputElement;
    const radioAdressModeRepeat = document.getElementById("radio-repeat") as HTMLInputElement;
    const radioAdressModeClampToEdge = document.getElementById("radio-clamp-to-edge") as HTMLInputElement;
    const radioFilterNearest = document.getElementById("radio-nearest") as HTMLInputElement;
    const radioFilterLinear = document.getElementById("radio-linear") as HTMLInputElement;

    sliderScale.addEventListener('input', () => {

        const scale = parseFloat(sliderScale.value);
        uniformV[offScale] = scale * 0.5;
        device.queue.writeBuffer(uniformBuffer, 0, uniformV);
        for(let colorAttachment of renderPassDescriptor.colorAttachments) {
            if(!colorAttachment) continue; 
            colorAttachment.view = context.getCurrentTexture().createView();
        }
        if(radioAdressModeRepeat.checked) {
            if(radioFilterNearest.checked) {
                draw(device, renderPassDescriptor, pipeline, planeVertexBuffer, indexBuffer, bindGroups[0]);
            } else {
                draw(device, renderPassDescriptor, pipeline, planeVertexBuffer, indexBuffer, bindGroups[1]);
            }
        } else {
            if(radioFilterNearest.checked) {
                draw(device, renderPassDescriptor, pipeline, planeVertexBuffer, indexBuffer, bindGroups[2]);
            } else {
                draw(device, renderPassDescriptor, pipeline, planeVertexBuffer, indexBuffer, bindGroups[3]);
            }
        }
    });

    const observer = new ResizeObserver(entries => {
        for(const entry of entries) {
            const canvas = (entry.target as HTMLCanvasElement);
            const width = entry.contentBoxSize[0].inlineSize;
            const height = entry.contentBoxSize[0].blockSize;
            canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
            canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
        }
        for(let colorAttachment of renderPassDescriptor.colorAttachments) {
            if(!colorAttachment) continue; 
            colorAttachment.view = context.getCurrentTexture().createView();
        }
        draw(device, renderPassDescriptor, pipeline, planeVertexBuffer, indexBuffer, bindGroups[0]);
        
    });
    observer.observe(canvas);


    for(let colorAttachment of renderPassDescriptor.colorAttachments) {
        if(!colorAttachment) continue; 
        colorAttachment.view = context.getCurrentTexture().createView();
    }

    draw(device, renderPassDescriptor, pipeline, planeVertexBuffer, indexBuffer, bindGroups[0]);
}

function draw(device: GPUDevice, renderPassDescriptor: GPURenderPassDescriptor, pipeline: GPURenderPipeline, planeVertexBuffer: GPUBuffer, indexBuffer: GPUBuffer, bindGroup: GPUBindGroup) {
    const encoder = device.createCommandEncoder({ label: 'my encoder'});
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, planeVertexBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(6);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}


main();