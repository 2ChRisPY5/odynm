/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * @internal
 */
export class ConditionBuilder {
	// current state
	readonly expressionValues: Record<string, any> = {};
	readonly expressionNames: Record<string, string> = {};
	private readonly addedAttributes = new Set<string>();
	private valueIdx: number;
	private nameIdx: number;
	private conditions: string[] = [];

	// constructor
	constructor(forward?: ConditionBuilder) {
		this.nameIdx = forward?.nameIdx ?? -1;
		this.valueIdx = forward?.valueIdx ?? -1;
	}

	/**
	 * Adds the given value to the expression values.
	 *
	 * @param value the value to add
	 * @return the expression value substitution
	 */
	readonly addExpressionValue = (value: any) => {
		const sub = `:v${++this.valueIdx}`;
		this.expressionValues[sub] = value;
		return sub;
	};

	/**
	 * Add the alias name for given property.
	 *
	 * @param name the actual property name
	 */
	readonly addExpressionName = (name: string) => {
		if(this.addedAttributes.has(name)) {
			return;
		}
		this.expressionNames[`#a${++this.nameIdx}`] = name;
		this.addedAttributes.add(name);
	};

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
	 * Get the current attribute expression. #a1
	 */
	get attributeExp() {
		return `#a${this.nameIdx}`;
	}

	/**
	 * Get the full condition or undefined if none were added.
	 */
	get fullCondition() {
		return this.conditions.length ? this.conditions.join(' AND ') : undefined;
	}
}
