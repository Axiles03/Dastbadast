import { GraphQLScalarType, Kind } from "graphql";

function parseLiteral(ast) {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
      return parseInt(ast.value, 10);
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.OBJECT: {
      const value = {};
      ast.fields.forEach((field) => {
        value[field.name.value] = parseLiteral(field.value);
      });
      return value;
    }
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    case Kind.NULL:
      return null;
    default:
      return null;
  }
}

export const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral,
});

/**
 * DateTime scalar — сериализует/парсит ISO-строки.
 * Используется во всех полях с типом Date в MongoDB
 * (statusTimestamps, paidAt, createdAt и т.д.), которые в схеме
 * резолвятся через .toISOString().
 */
export const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO-8601 date-time string",
  serialize(value) {
    if (value == null) return null;
    if (value instanceof Date) return value.toISOString();
    return String(value);
  },
  parseValue(value) {
    if (value == null) return null;
    return new Date(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    return null;
  },
});
