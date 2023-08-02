# ODynM
ODynM is a simple mapper from custom JavaScript classes to DynamoDB items and vice-versa.That is the main reason why I called it "Object DynamoDB Mapper" instead of the well-known ORM because DynamoDB is by design not a relational database.

It is implemented from scratch using latest JS features and without any dependencies other than then AWS Client v3. It is a convenient gateway for doing basic CRUD operations on DynamoDB tables and its' items.

**Attention:** ODynM only operates on items. Every item is treated encapsulated and there exist no relations between them. Relational data modeling like @ManyToOne from JPA is **not** supported.


## Features
- Only supports the AWS Client v3
- Class inheritance
- Repository - easy `get`, `getMany`, `put`, `putAll`, `query`, `scan`, `delete`, `deleteAll`, `update` and `updateAll` operations
- Supports all conditions and conditional functions provided by DynamoDB
- Lifecycle hooks `PrePut`, `PreUpdate` and `PostLoad`
- Built for CJS and ESM
- Full type-safe
- Does not need "reflect-metadata"

## Not supported
- Relational data modeling
- Auto-generated attributes
- Parallel scan
- Pagination
- Transaction management
- For update opertion: Only SET and REMOVE are supported
- ... for sure a view more ...

If you need a much much more powerful solution you should have a look at [TypeDORM](https://github.com/typedorm/typedorm) for example.


## Getting started
### Installation
1. Install the module from npm: `npm install odynm`
2. If you do not have the AWS DynamoDB Client v3 already installed you will get a warning that `odynm requires a peer dependency to @aws-sdk/...`

	In this case you also need to install `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`.


### Typescript configuration
If you are using Typescript make sure that the following option is enabled:
```json
{
	"experimentalDecorators": true
}
```


### Using ODynM
#### Defining a table
You actually don't need to define a table. If you only pass the table name to an item configuration the following defaults will be used:
```typescript
{
	partitionKey: { name: 'pk', type: String },
	sortKey: { name: 'sk', type: String }
}
```
But in 99.9% of the cases you will use different column names for the partitionKey and sortKey. So here we go ...
```typescript
import { Table } from 'odynm';

const table: Table = {
	name: 'table',
	partitionKey: 'partition',
	sortKey: { name: 'sort', type: Number },
	lsi: {
		// LSI named 'LSI1' maps to DynamoDB attribute 'sk2'
		LSI1: 'sk2'
	},
	gsi: {
		// some configuration possibilities as for primary partitionKey and sortKey
		GSI1: {
			partitionKey: 'pk3',
			sortKey: { name: 'sk3', type: Number }
		}
	}
};
```
You can define for both keys how they are called in DynamoDB and what type they are. Currently only `String` and `Number` is supported.


#### Define an item
```typescript
import { Item, Attribute, PrePut, PreUpdate, PostLoad } from 'odynm';

@Item({
	table: table,
	key: {
		// templates here must match member names
		partitionKey: '{{firstName}}#{{lastName}}',
		sortKey: 'AUTHOR'
	},
	lsi: {
		// expression for sortKey of LSI named 'LSI1'
		LSI1: '{{books}}'
	},
	gsi: {
		// equald to 'key' definition above
		GSI1: { partitionKey: '{{lastName}}', sortKey: '{{age}}' }
	}
})
export class Author {
	// members used in key expressions don't need to be decorated
	firstName: string;
	lastName: string;

	// primitiv types like number, string, boolean don't need a type
	// declaration
	@Attribute()
	age?: number;

	// override column name in DynamoDB
	@Attribute({ name: 'numberOfBooks' })
	books?: number;

	// for special types you need to declare the constructor type
	// constructor must have exact one parameter
	@Attribute({ type: Set })
	publications?: Set<string>;

	// You dont need to define a constructor for your items but if you do
	// all parameters must be optional because they won't be used by ODynM
	constructor(input?: Author) {
		...
	}

	// you can also define lifecycle hooks (supported multiple times)
	// function names can be choosen freely
	@PrePut
	private readonly prePut = () => {
		...
	};

	@PreUpdate
	private readonly preUpdate = () => {
		...
	};

	@PostLoad
	private readonly postLiad = () => {
		...
	};
}
```
You can also use custom classes as attribute types but you have to implement a constructor with exactly one argument. The argument's type is the class itself. For example:
```typescript
export class Nested {
	attribute_1: string;
	attribute_2: string;

	constructor(input: Nested) {
		...
	}
}
```

There is one more configuration which can be done using `@Attribute`. You can set `partitionKey` and/or `sortKey` to `true`. See following example for usage.
```typescript
@Attribute({ partitionKey: true })
readonly fullName: string;

// has the same meaning as doing

@Item({
	table: {
		name: '...',
		partitionKey: 'fullName'
	},
	key: {
		partitionKey: '{{fullName}}'
	}
})
```

It tells the metamodel that the partitionKey is exactly the value from `fullName` and that the DynamoDB column is also named as the member. A minimal example would be:
```typescript
@Item({
	table: 'authors'
})
export class Author {
	@Attribute({ partitionKey: true })
	readonly fullName: string;
}
```
__Attention:__ `partitionKey` and `sortKey` on attribute level can only be used once per class! Composite keys must always be configured using `@Item`.

Sometimes it is also needed to declare types even if they are primitive. This is needed if the type of the partitionKey or sortKey differs from the property type used as template.
```typescript
@Item({
	table: {
		name: '...',
		key: { partitionKey: 'BOOK{{title}}#CHAPTER{{chapter}}' }
	}
})
export class Book {
	// not needed here because partitionKey = String and title = String
	readonly title: string;

	// because partitionKey = String and chapter = Number
	// only one of these is needed
	@Attribute({ type: Number })
	@Type(Number)
	readonly chapter: number;
}
```


#### Working with ODynM
```typescript
import { ODynM } from 'odynm';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// always initialize ODynM outside
// if no client is passed a default one will be created
const odynm = ODynM.initialize(DynamoDBDocumentClient.from(new DynamoDBClient({})));

// default Lambda handler declaration
export const handler = async (...) => {
	const repo = odynm.getRepository(Author);

	// create Author instance
	const author = new Author('Cool', 'Name');
	author.age = 26;
	author.books = 0;
	author.publications = new Set<string>();

	// put
	await repo.put(author);

	// get
	await repo.get({ firstName: 'Cool', lastName: 'Name' });

	// update
	author.books = 1;
	author.publications.add('Nice title');
	await repo.update(author);

	// delete
	await repo.delete({ firstName: 'Cool', lastName: 'Name' });
};
```

There are now two more operations which need some special explanation.
```typescript
import { greaterThan, contains } from 'odynm';

repo.query({
	firstName: 'Cool', // values must be supplied because they are used in
	lastName: 'Name',  // partitionKey expression

	// uses equal function
	age: 26,

	// condition functions can be used for every decorated attribute
	books: greaterThan(0),
	publications: contains('Nice title')
});
```
As mentioned in the comments, you have to provide the actual values for all properties used in partitionKey expressions. Thats because the partitionKey must be fully specified anyways.

Providing the query for sortKey has some special treatment you need to be aware of. Let's consider the following expression: `BOOK:{{title}}#CHAPTER:{{chapter}}` If you supply multiple inputs in the query specification, preceeding template values are considered as equal. Here are some examples to get a picture of it:

Example 1:
```typescript
// beginsWith(sortKey, 'BOOK:Something#CHAPTER:1')
repo.query({
	title: 'Something',
	chapter: 1
});
```
Example 2:
```typescript
// beginsWith(sortKey, 'BOOK:Something')
repo.query({
	title: 'Something'
});
```
Example 3:
```typescript
// beginsWith(sortKey, 'BOOK:') AND title = 'Something' AND chapter > 1
repo.query({
	title: equal('Something'),
	chapter: greaterThen(1)
});
```

For all other properties you can either use values or pass a condition function. If a value is passed `equal` will be used for comparison.

Furthermore you can optionally define a condition function for sortKey comparison. The default will be `beginsWith`. Allowed functions are `beginsWith`, `equal`, `lessThen`, `greaterThen`, `lassThanOrEqual` and `greaterThanOrEqual`.

The last operation `scan` is more complex. When it comes to building the key conditions ODynM does not know what the value exactly looks like. It could be f.e. the full string or only a portion of it at any place. So ODynM tries to find the best fitting conditions for the scan operation. Let's consider the following key expressions:
```typescript
// partitionKey
'FIRST:{{firstName}}#LAST:{{lastName}}'

// sort key
'BOOK#{{title}}'
```
Example 1:
```typescript
// beginsWith(partitionKey, 'FIRST:Hello') AND contains(partitionKey, '#LAST:there')
// AND beginsWith(sortKey, 'BOOK#')
repo.scan({
	firstName: 'Hello',
	lastName: 'there'
});
```
Example 2:
```typescript
// beginsWith(partitionKey, 'FIRST:') AND contains(partitionKey, '#LAST:')
// AND beginsWith(sortKey, 'BOOK#') AND contains(firstName, 'Hello')
// AND lastName = 'there'
repo.scan({
	firstName: contains('Hello'),
	lastName: equal('there')
});
```
As you can see: When providing values for key expression templates the library tries to find the best fitting condition on its' own. If custom conditions are used they are treated as normal attributes.

For attributes not used in key expressions the default condition used is `equal`.
