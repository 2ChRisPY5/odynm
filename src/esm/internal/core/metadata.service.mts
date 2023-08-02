/* eslint-disable @typescript-eslint/no-explicit-any */
import { Optional } from '../../utils/optional.mjs';
import { Metadata } from '../metadata.mjs';
import { Constructable } from '../types.mjs';

// @internal
const DEFAULT_METADATA = new Metadata();

/**
 * Global service for managing metadata
 * @internal
 */
export class MetadataService {
	private static instance?: MetadataService;

	private readonly cache = new Map<any, Metadata>();

	private constructor() {
		if(MetadataService.instance) {
			throw new Error('Instance already created. Please use MetadataService#getInstnace().');
		}
	}

	/**
	 * Get the metadata for given class prototype.
	 *
	 * @param prototype the class prototype
	 * @returns the metadata
	 */
	readonly getMetadata = (prototype: any): Metadata => {
		if(this.cache.has(prototype)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return this.cache.get(prototype)!;
		}

		// clone superlcass metadata if present; or create a new one
		this.cache.set(prototype, Optional.of(this.cache.get(Object.getPrototypeOf(prototype)))
			.map(meta => meta.clone())
			.orElseGet(DEFAULT_METADATA.clone));

		return this.getMetadata(prototype);
	};

	/**
	 * Check if given class has metadata.
	 *
	 * @param constr the class type
	 * @returns true or false
	 */
	readonly hasMetadata = (constr: Constructable) => this.cache.has(constr.prototype);

	/**
	 * Validate the metadata for given class type.
	 *
	 * @param constr the class type
	 */
	readonly validate = (constr: Constructable) => {
		const metadata = this.getMetadata(constr.prototype);
		const pk = metadata.getPartitionKey();

		// partitionKey checks
		if(!pk.expression?.trim().length) {
			throw new Error(`No expression for "partitionKey" set on ${constr.name}`);
		}
		if(pk.expression?.indexOf('}}{{') > -1) {
			throw new Error(
				`The partitionKey expression on type ${constr.name} contains templates not separated by static text: ${pk.expression}`
			);
		}

		// sortKey checks
		metadata.getSortKey().ifPresent(sk => {
			if(!sk.expression?.trim().length) {
				throw new Error(`${constr.name} uses ${sk.name} as sortKey but no expression is defined.`);
			}
			if(sk.expression?.indexOf('}}{{') > -1) {
				throw new Error(
					`The sortKey expression on type ${constr.name} contains templates not separated by static text: ${sk.expression}`
				);
			}
		});

		metadata.finalize();
	};

	/**
	 * Get the instance of the service.
	 */
	static readonly getInstance = () => {
		if(!MetadataService.instance) {
			MetadataService.instance = new MetadataService();
		}
		return MetadataService.instance;
	};
}
