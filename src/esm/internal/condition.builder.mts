/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * @internal
 */
export class ConditionBuilder {
	// current state
	private readonly expressionValues: Record<string, any> = {};
	private readonly expressionNames: Record<string, string> = {};
	private idx: number;
	private conditions: string[] = [];

	// constructor
	constructor(startAt = 0) {
		this.idx = startAt;
	}

	/**
	 * Adds the given value to the expression values.
	 *
	 * @param value the value to add
	 */
	readonly addExpressionValue = (value: any) => this.expressionValues[`:v${this.idx}`] = value;

	/**
	 * Add the alias name for given property.
	 *
	 * @param name the actual property name
	 */
	readonly addExpressionName = (name: string) => this.expressionNames[`#a${this.index}`] = name;

	/**
	 * Gets the next index.
	 */
	readonly nextIndex = () => ++this.idx;

	/**
	 * Add the given conditions.
	 *
	 * @param conds the conditions to add
	 */
	readonly addConditions = (...conds: string[]) => this.conditions.push(...conds);

	/**
	 * Removes and returns the last condition added.
	 */
	readonly removeLastCondition = () => this.conditions.splice(this.conditions.length - 1, 1)[0];

	/**
	 * Merges this builder with the given one and return the ExpressionAttributeNames and ExpressionAttributeValues.
	 *
	 * @param builder another builder to merge with
	 * @returns the merged ExpressionAttributeNames and ExpressionAttributeValues
	 */
	readonly getMergedExpressions = (builder: ConditionBuilder) => {
		const merged = {
			ExpressionAttributeNames: { ...this.expressionNames },
			ExpressionAttributeValues: { ...this.expressionValues }
		};
		Object.assign(merged.ExpressionAttributeNames, builder.expressionNames);
		Object.assign(merged.ExpressionAttributeValues, builder.expressionValues);

		return merged;
	};

	/**
	 * Get the current index
	 */
	get index() {
		return this.idx;
	}

	/**
	 * Get the current attribute expression. #a1
	 */
	get attributeExp() {
		return `#a${this.idx}`;
	}

	/**
	 * Get the current value expression. :v1
	 */
	get valueExp() {
		return `:v${this.idx}`;
	}

	/**
	 * Get the full condition or undefined if none were added.
	 */
	get fullCondition() {
		return this.conditions.length ? this.conditions.join(' AND ') : undefined;
	}

	/**
	 * Get the partial command input containin ExpressionAttributeNames and ExpressionAttributeValues.
	 */
	get partialInput() {
		return {
			ExpressionAttributeNames: this.expressionNames,
			ExpressionAttributeValues: this.expressionValues
		};
	}
}
