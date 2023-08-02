/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-constraint */
export type Nullable<T> = T | undefined | null;

/**
 * Java-like optional implementation
 */
export class Optional<T> {
	private constructor(private readonly value?: Nullable<T>) {}

	/**
	 * Map value to a new one.
	 *
	 * @param fn the mapping function
	 * @returns new optional with mapped value
	 */
	readonly map = <U extends any> (fn: (val: T) => Nullable<U>) => {
		if(this.value) {
			return new Optional<U>(fn(this.value));
		}
		return new Optional<U>();
	};

	/**
	 * Same as map():
	 *
	 * @param fn mapping function to new optional
	 * @returns new optional with mapped value
	 */
	readonly flatMap = <U extends any> (fn: (val: T) => Optional<U>) => {
		if(this.value) {
			return fn(this.value);
		}
		return new Optional<U>();
	};

	/**
	 * If predicate evaluates to false; a new empty optional will be returned.
	 *
	 * @param fn the predicate function
	 * @returns new empty optional or this
	 */
	readonly filter = (fn: (val: T) => boolean) => {
		if(this.value && fn(this.value)) {
			return this;
		}
		return new Optional<T>();
	};

	/**
	 * Get the internal value.
	 *
	 * @returns internal value
	 * @throws if no value is present
	 */
	readonly get = () => this.elseThrow(() => new Error('No value present'));

	/**
	 * Returns undefined.
	 *
	 * @returns always return undefined
	 */
	readonly elseUndefined = (): T | undefined => this.value ?? undefined;

	/**
	 * Get internal value or given alternative.
	 *
	 * @param other alternative value
	 * @returns internal value or given one
	 */
	readonly orElse = (other: T): T => this.value ?? other;

	/**
	 * Get internal value or from given function.
	 *
	 * @param fn alternative supplier
	 * @returns internal value or return value from function
	 */
	readonly orElseGet = (fn: () => T): T => this.value ?? fn();

	/**
	 * Returns the value if present or throws given error.
	 *
	 * @param err error supplier function
	 * @returns the value if present
	 * @throws the supplied error
	 */
	readonly elseThrow = (err: () => Error): T => {
		if(this.value) {
			return this.value;
		}
		throw err();
	};

	/**
	 * Switch to alternative optional if this is empty.
	 *
	 * @param fn alternative optional supplier
	 * @returns this or alternative optional
	 */
	readonly or = (fn: () => Optional<T>) => this.value ? this : fn();

	/**
	 * Checks if a value is present.
	 *
	 * @returns true or false
	 */
	readonly isPresent = () => this.value != null;

	/**
	 * Check if a value is not present.
	 *
	 * @returns true or false
	 */
	readonly isNotPresent = () => !this.isPresent();

	/**
	 * Consume value if present.
	 *
	 * @param fn the value consumer
	 */
	readonly ifPresent = (fn: (val: T) => void) => {
		if(this.isPresent()) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			fn(this.value!);
		}
	};

	/**
	 * Perform action if value is not present.
	 *
	 * @param fn the action to perform
	 */
	readonly ifNotPresent = (fn: () => void) => {
		if(this.isNotPresent()) {
			fn();
		}
	};

	/**
	 * Create an Optional for given value.
	 *
	 * @param value the optional value
	 * @returns the Optional instance
	 */
	static readonly of = <U extends any> (value?: Nullable<U>) => new Optional<U>(value);
}
