/* eslint-disable @typescript-eslint/no-explicit-any */
import { MetadataService } from '../internal/core/metadata.service.mjs';

/**
 * Adds the decorated function to be executed before item gets put by repository.
 * No function arguments are allowed. Return will be ignored.
 */
export const PrePut = (prototype: any, name: string) => {
	MetadataService.getInstance().getMetadata(prototype).addHook('prePut', name);
};

/**
 * Adds the decorated function to be executed before item gets updated by repository.
 * No function arguments are allowed. Return will be ignored.
 */
export const PreUpdate = (prototype: any, name: string) => {
	MetadataService.getInstance().getMetadata(prototype).addHook('preUpdate', name);
};

/**
 * Adds the decorated function to be executed after item was retrieved by repository.
 * No function arguments are allowed. Return will be ignored.
 */
export const PostLoad = (prototype: any, name: string) => {
	MetadataService.getInstance().getMetadata(prototype).addHook('postLoad', name);
};
