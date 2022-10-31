import { UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { Value } from '@aws-sdk/smithy-client';

/**
 * Update expression builder
 */
export class UpdateBuilder {
	private index = 0;

	// expressions
	private readonly valueExpressions: Record<string, Value> = {};
	private readonly attributeExpressions: Record<string, string> = {};

	// operations
	private readonly setOperations: string[] = [];
	private readonly removeOperations: string[] = [];
	private readonly addOpertions: string[] = [];
	private readonly deleteOpertions: string[] = [];

	// increment and return index
	readonly nextIndex = () => ++this.index;

	// add the value to expressions
	readonly addValue = (value: Value) => this.valueExpressions[`:v${this.index}`] = value;

	// add the attribute to expressions
	readonly addAttribute = (name: string) => this.attributeExpressions[`#a${this.index}`] = name;

	// Add given expression to SET
	readonly addSet = (expression: string) => this.setOperations.push(expression);

	// remove current attribute index
	readonly addRemove = () => this.removeOperations.push(this.attributeExpression);

	// Add current index attribute and value as ADD opertion
	readonly addAdd = () => this.addOpertions.push(`${this.attributeExpression} ${this.valueExpression}`);

	// Add current index attribute and value as DELETE opertion
	readonly addDelete = () => this.deleteOpertions.push(`${this.attributeExpression} ${this.valueExpression}`);

	// Build the partial update command input
	readonly build = (): Partial<UpdateCommandInput> => {
		const expressions: string[] = [];
		if(this.setOperations.length) {
			expressions.push('SET', this.setOperations.join(', '));
		}
		if(this.addOpertions.length) {
			expressions.push('ADD', this.addOpertions.join(', '));
		}
		if(this.removeOperations.length) {
			expressions.push('REMOVE', this.removeOperations.join(', '));
		}
		if(this.deleteOpertions.length) {
			expressions.push('DELETE', this.deleteOpertions.join(', '));
		}

		return {
			ExpressionAttributeNames: this.attributeExpressions,
			ExpressionAttributeValues: this.valueExpressions,
			UpdateExpression: expressions.join(' '),
			ReturnValues: 'ALL_NEW'
		};
	};

	// get the attribute expression
	get attributeExpression(): string {
		return `#a${this.index}`;
	}

	// get the value expression
	get valueExpression(): string {
		return `:v${this.index}`;
	}
}
