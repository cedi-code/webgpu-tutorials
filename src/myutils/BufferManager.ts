import { UniformBufferDescriptor, VertexBufferDescriptor } from "../mytypes";

interface BufferManager {

    device?: GPUDevice;

    init(device: GPUDevice): void;

    createVertexBuffer(descriptor: VertexBufferDescriptor): GPUBuffer;

    createUniformBuffer(descriptor: UniformBufferDescriptor): GPUBuffer;
}

export const bufferManager: BufferManager = {

    init(device: GPUDevice): void {
        this.device = device;
    },

    createVertexBuffer(descriptor: VertexBufferDescriptor): GPUBuffer {
        // TODO calculate size
        if(!this.device) {
            throw new Error("BufferManager not initialized with device");
        }
        const buffer = this.device.createBuffer({
            label: descriptor.label,
            size: 0,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        return buffer;
    },

    createUniformBuffer(descriptor: UniformBufferDescriptor): GPUBuffer {
        if(!this.device) {
            throw new Error("BufferManager not initialized with device");
        }
        const buffer = this.device.createBuffer({
            label: descriptor.label,
            size: descriptor.size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });

        return buffer;
    },
};