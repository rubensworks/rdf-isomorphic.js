# RDF Isomorphism

[![Build Status](https://travis-ci.org/rubensworks/rdf-isomorphic.js.svg?branch=master)](https://travis-ci.org/rubensworks/rdf-isomorphic.js)
[![Coverage Status](https://coveralls.io/repos/github/rubensworks/rdf-isomorphic.js/badge.svg?branch=master)](https://coveralls.io/github/rubensworks/rdf-isomorphic.js?branch=master)
[![npm version](https://badge.fury.io/js/rdf-isomorphic.svg)](https://www.npmjs.com/package/rdf-isomorphic)

Determines if two RDF graphs are [isomorphic](https://www.w3.org/TR/rdf11-concepts/#graph-isomorphism),
i.e., if two RDF graphs are equal while ignoring quad order
and ignoring non-equal blank node labels between the graphs.

This package is can be useful within unit/spec tests.

This library accepts [RDFJS](http://rdf.js.org/)-compliant quads.

## Usage

The following examples assume the following imports:

```javascript
import { DataFactory } from "rdf-data-factory"; // External library
import { isomorphic } from "rdf-isomorphic";

const factory = new DataFactory();
```

### Check if two graphs are isomorphic

```javascript
const graphA = [
  factory.quad(
    factory.blankNode('s1'),
    factory.namedNode('p'),
    factory.blankNode('o1'),
  ),
];
const graphB = [
  factory.quad(
    factory.blankNode('s2'),
    factory.namedNode('p'),
    factory.blankNode('o2'),
  ),
];
isomorphic(graphA, graphB); // Outputs true
```

### Check if two graphs are **not** isomorphic

```javascript
const graphA = [
  factory.quad(
    factory.blankNode('s1'),
    factory.namedNode('p1'),
    factory.blankNode('o1'),
  ),
];
const graphB = [
  factory.quad(
    factory.blankNode('s2'),
    factory.namedNode('p2'),
    factory.blankNode('o2'),
  ),
];
isomorphic(graphA, graphB); // Outputs false
```

### Check if two graphs with nested quads are isomorphic

```javascript
const graphA = [
  factory.quad(
    factory.quad(
      factory.blankNode('sInner'),
      factory.namedNode('pInner'),
      factory.blankNode('o1'),
    ),
    factory.namedNode('pOuter'),
    factory.namedNode('oOuter'),
  )
];
const graphB = [
  factory.quad(
    factory.quad(
      factory.blankNode('sInner'),
      factory.namedNode('pInner'),
      factory.blankNode('o2'),
    ),
    factory.namedNode('pOuter'),
    factory.namedNode('oOuter'),
  )
];
isomorphic(graphA, graphB); // Outputs true
```

## Algorithm

This algorithm is based on the [RDF isomorphism checker in RDF.rb](http://blog.datagraph.org/2010/03/rdf-isomorphism),
which in its turn is based on the algorithm described by [Jeremy Carrol](http://www.hpl.hp.com/techreports/2001/HPL-2001-293.pdf).

In summary, the algorithm generates a hash for each blank node based on the connected resources.
These hashes are then compared between the two given graphs, and a bijection is attempted to be created.
If no such bijection can be found, then the graphs are considered non-isomorphic.

The implementation of this package is inspired by the Ruby [RDF::Isomorphic](https://github.com/ruby-rdf/rdf-Isomorphic) gem.

The algorithm has been adapted to work this nested quads by [Ruben Taelman](http://rubensworks.net/).

## License
This software is written by [Ruben Taelman](http://rubensworks.net/).

This code is released under the [MIT license](http://opensource.org/licenses/MIT).
