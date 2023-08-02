/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConditionBuilder } from './condition.builder.mjs';
import { UpdateBuilder } from './update.builder.mjs';

export type Constructable = { new (value?: any): object }

export type Value = string | number | boolean | null;
export type Comparator = '=' | '<>' | '<' | '<=' | '>' | '>=';
export type ConditionBuilderFunc = (builder: ConditionBuilder) => void;
export type ConditionFunc = (value: Value) => ConditionBuilderFunc;
export type UpdateBuilderFn = (builder: UpdateBuilder) => void;


// construct a type of all properties which can also have a condition builder function
export type QuerySpecification<T> = {
	[K in keyof T]?: T[K] | ConditionBuilderFunc;
}

// construct a type of all properties which can also have a update builder function
export type UpdateSpecification<T> = {
	[K in keyof T]?: T[K] | UpdateBuilderFn;
};
