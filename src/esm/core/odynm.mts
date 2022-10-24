/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { MetadataService } from '../internal/core/metadata.service.mjs';
import { RepositoryImpl } from '../internal/core/repository.impl.mjs';
import { Constructable } from '../internal/types.mjs';
import { Repository } from './repository.mjs';

/**
 * Main entry point for interactions with the library. This instance should be created only once and cached afterwards.
 */
export class ODynM {
	private readonly repositories = new Map<Constructable, Repository<any>>();

	private constructor(private readonly client: DynamoDBDocumentClient) {}

	/**
	 * Creates and initializes a new instance.
	 *
	 * @param client The (optional) DynamoDBDocumentClient used for operations. If none is provided a default instance will be created.
	 * @returns a newly created ODynM instance
	 */
	static readonly initialize = (client = DynamoDBDocumentClient.from(new DynamoDBClient({}))) => new ODynM(client);

	/**
	 * Get the repository for the given type.
	 *
	 * @param type the type to create the repository for
	 * @returns the repository instance
	 * @throws if type is not annotated with \@Item
	 */
	readonly getRepository = <T extends Constructable>(type: T): Repository<InstanceType<T>> => {
		if(!this.repositories.has(type)) {
			// perform check
			if(!MetadataService.getInstance().hasMetadata(type)) {
				throw new Error(`${type.name} is not annotated with @Item`);
			}

			this.repositories.set(type, new RepositoryImpl(type, this.client));
		}
		return this.repositories.get(type)!;
	};
}
