/* eslint-disable @typescript-eslint/no-explicit-any */
import { MetadataService } from '../internal/core/metadata.service.mjs';
import { Constructable } from '../internal/types.mjs';

/**
 * Defines to which type the property is mapped to. This applies for read and write operations.
 *
 * When using primitve types {@link string}, {@link number} or {@link boolean} this decorator can be omitted.
 * This is needed if you want to use types like f.e. {@link Set}.
 *
 * @param type the type used in the item class
 */
export const Type = (type: Constructable) => (prototype: any, property: string) => {
	MetadataService.getInstance().getMetadata(prototype).setType(property, type);
};
