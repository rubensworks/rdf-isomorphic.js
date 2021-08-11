import { DataFactory } from "rdf-data-factory";
import {createReadStream, readdirSync} from "fs";
import {StreamParser} from 'n3';
import * as RDF from "@rdfjs/types";
import {
  deindexGraph,
  getGraphBlankNodes, getQuadsWithBlankNodes, getQuadsWithoutBlankNodes,
  hashTerm,
  hashTerms, hashValues, hasValue, indexGraph,
  isomorphic,
  isTermGrounded,
  quadToSignature,
  sha1hex,
  termToSignature, uniqGraph,
} from "../lib/RdfIsomorphic";
// tslint:disable-next-line:no-var-requires
const arrayifyStream = require('arrayify-stream');

const DF = new DataFactory<RDF.BaseQuad>();

describe('isomorphic', () => {
  loadIsomorphicFiles(__dirname + '/assets/isomorphic/', true);
  loadIsomorphicFiles(__dirname + '/assets/non_isomorphic/', false);

  describe('for pathological cases', () => {
    /* These cases are not possible in practise, as RDF does not allow blank predicates. */
    it('should be isomorphic for 2 graphs with single full-blank triples', () => {
      const graphA = [
        DF.quad(
          DF.blankNode('a1'),
          DF.blankNode('b1'),
          DF.blankNode('c1'),
        ),
      ];
      const graphB = [
        DF.quad(
          DF.blankNode('a2'),
          DF.blankNode('b2'),
          DF.blankNode('c2'),
        ),
      ];
      return expect(isomorphic(graphA, graphB)).toBe(true);
    });

    it('should be isomorphic for 2 graphs with two unconnected full-blank triples', () => {
      const graphA = [
        DF.quad(
          DF.blankNode('a1'),
          DF.blankNode('b1'),
          DF.blankNode('c1'),
        ),
        DF.quad(
          DF.blankNode('d1'),
          DF.blankNode('e1'),
          DF.blankNode('f1'),
        ),
      ];
      const graphB = [
        DF.quad(
          DF.blankNode('a2'),
          DF.blankNode('b2'),
          DF.blankNode('c2'),
        ),
        DF.quad(
          DF.blankNode('d2'),
          DF.blankNode('e2'),
          DF.blankNode('f2'),
        ),
      ];
      return expect(isomorphic(graphA, graphB)).toBe(true);
    });

    it('should be isomorphic for 2 graphs with two connected full-blank triples', () => {
      const graphA = [
        DF.quad(
          DF.blankNode('a1'),
          DF.blankNode('b1'),
          DF.blankNode('c1'),
        ),
        DF.quad(
          DF.blankNode('c1'),
          DF.blankNode('e1'),
          DF.blankNode('f1'),
        ),
      ];
      const graphB = [
        DF.quad(
          DF.blankNode('a2'),
          DF.blankNode('b2'),
          DF.blankNode('c2'),
        ),
        DF.quad(
          DF.blankNode('c2'),
          DF.blankNode('e2'),
          DF.blankNode('f2'),
        ),
      ];
      return expect(isomorphic(graphA, graphB)).toBe(true);
    });

    it('should be isomorphic for 2 graphs with two connected partially-blank triples', () => {
      const graphA = [
        DF.quad(
          DF.namedNode('a1'),
          DF.blankNode('b1'),
          DF.blankNode('c1'),
        ),
        DF.quad(
          DF.blankNode('c1'),
          DF.blankNode('e1'),
          DF.blankNode('f1'),
        ),
      ];
      const graphB = [
        DF.quad(
          DF.namedNode('a1'),
          DF.blankNode('b2'),
          DF.blankNode('c2'),
        ),
        DF.quad(
          DF.blankNode('c2'),
          DF.blankNode('e2'),
          DF.blankNode('f2'),
        ),
      ];
      return expect(isomorphic(graphA, graphB)).toBe(true);
    });

    it('should be isomorphic for 2 equal graphs where one contains duplicates', () => {
      const graphA = [
        DF.quad(
          DF.namedNode('a1'),
          DF.blankNode('b1'),
          DF.blankNode('c1'),
        ),
      ];
      const graphB = [
        DF.quad(
          DF.namedNode('a1'),
          DF.blankNode('b2'),
          DF.blankNode('c2'),
        ),
        DF.quad(
          DF.namedNode('a1'),
          DF.blankNode('b2'),
          DF.blankNode('c2'),
        ),
        DF.quad(
          DF.namedNode('a1'),
          DF.blankNode('b2'),
          DF.blankNode('c2'),
        ),
      ];
      return expect(isomorphic(graphA, graphB)).toBe(true);
    });

    it('should not be isomorphic for 2 graphs with single full-blank triples', () => {
      const graphA = [
        DF.quad(
          DF.blankNode('a1'),
          DF.blankNode('b1'),
          DF.blankNode('a1'),
        ),
      ];
      const graphB = [
        DF.quad(
          DF.blankNode('a2'),
          DF.blankNode('b2'),
          DF.blankNode('c2'),
        ),
      ];
      return expect(isomorphic(graphA, graphB)).toBe(false);
    });
  });
});

function loadIsomorphicFiles(path: string, expected: boolean) {
  for (const subDir of readdirSync(path)) {
    it(subDir + (expected ? ' should contain isomorphic graphs' : ' should contain non-isomorphic graphs'),
      async () => {
        const graphA = await loadGraph(path + subDir + '/' + subDir + '-1.nq');
        const graphB = await loadGraph(path + subDir + '/' + subDir + '-2.nq');
        return expect(isomorphic(graphA, graphB)).toBe(expected);
      });
  }
}

function loadGraph(file: string): Promise<RDF.Quad[]> {
  return arrayifyStream(createReadStream(file).pipe(new StreamParser({ baseIRI: file })));
}

describe('hashValues', () => {
  it('should return an empty array for an empty hash', () => {
    return expect(hashValues({})).toEqual([]);
  });

  it('should return a non-empty array for a non-empty hash', () => {
    return expect(hashValues({
      0: 'aa',
      11: 'bb',
      22: 'cc',
    })).toEqual([
      'aa',
      'bb',
      'cc',
    ]);
  });
});

describe('hasValue', () => {
  it('should false for an empty hash', () => {
    return expect(hasValue({}, 'aa')).toBeFalsy();
  });

  it('should false for a hash without the given value', () => {
    return expect(hasValue({
      11: 'bb',
      22: 'cc',
    }, 'aa')).toBeFalsy();
  });

  it('should true for a hash with the given value', () => {
    return expect(hasValue({
      0: 'aa',
      11: 'bb',
      22: 'cc',
    }, 'aa')).toBeTruthy();
  });
});

describe('getQuadsWithBlankNodes', () => {
  it('should return an empty array for an empty graph', () => {
    return expect(getQuadsWithBlankNodes([])).toEqual([]);
  });

  it('should return an the correct quads for a non-empty graph', () => {
    return expect(getQuadsWithBlankNodes([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.namedNode('s2'),
        DF.namedNode('p2'),
        DF.blankNode('o2'),
        DF.namedNode('g2'),
      ),
      DF.quad(
        DF.namedNode('s3'),
        DF.namedNode('p3'),
        DF.namedNode('o3'),
        DF.namedNode('g3'),
      ),
    ])).toEqual([
      DF.quad(
        DF.namedNode('s2'),
        DF.namedNode('p2'),
        DF.blankNode('o2'),
        DF.namedNode('g2'),
      ),
    ]);
  });

  it('should return an the correct quads for nested quads', () => {
    return expect(getQuadsWithBlankNodes([
      DF.quad(
        DF.quad(
          DF.namedNode('s1'),
          DF.namedNode('p1'),
          DF.namedNode('o1'),
          DF.namedNode('g1'),
        ),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.quad(
          DF.namedNode('s2'),
          DF.namedNode('p2'),
          DF.blankNode('o2'),
          DF.namedNode('g2'),
        ),
        DF.namedNode('p2'),
        DF.namedNode('o2'),
        DF.namedNode('g2'),
      ),
      DF.quad(
        DF.quad(
          DF.namedNode('s3'),
          DF.namedNode('p3'),
          DF.quad(
            DF.namedNode('s3'),
            DF.namedNode('p3'),
            DF.blankNode('o3'),
            DF.namedNode('g3'),
          ),
          DF.namedNode('g3'),
        ),
        DF.namedNode('p3'),
        DF.namedNode('o3'),
        DF.namedNode('g3'),
      ),
    ])).toEqual([
      DF.quad(
        DF.quad(
          DF.namedNode('s2'),
          DF.namedNode('p2'),
          DF.blankNode('o2'),
          DF.namedNode('g2'),
        ),
        DF.namedNode('p2'),
        DF.namedNode('o2'),
        DF.namedNode('g2'),
      ),
      DF.quad(
        DF.quad(
          DF.namedNode('s3'),
          DF.namedNode('p3'),
          DF.quad(
            DF.namedNode('s3'),
            DF.namedNode('p3'),
            DF.blankNode('o3'),
            DF.namedNode('g3'),
          ),
          DF.namedNode('g3'),
        ),
        DF.namedNode('p3'),
        DF.namedNode('o3'),
        DF.namedNode('g3'),
      ),
    ]);
  });
});

describe('getQuadsWithoutBlankNodes', () => {
  it('should return an empty array for an empty graph', () => {
    return expect(getQuadsWithoutBlankNodes([])).toEqual([]);
  });

  it('should return an the correct quads for a non-empty graph', () => {
    return expect(getQuadsWithoutBlankNodes([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.namedNode('s2'),
        DF.namedNode('p2'),
        DF.blankNode('o2'),
        DF.namedNode('g2'),
      ),
      DF.quad(
        DF.namedNode('s3'),
        DF.namedNode('p3'),
        DF.namedNode('o3'),
        DF.namedNode('g3'),
      ),
    ])).toEqual([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.namedNode('s3'),
        DF.namedNode('p3'),
        DF.namedNode('o3'),
        DF.namedNode('g3'),
      ),
    ]);
  });

  it('should return an the correct quads for nested quads', () => {
    return expect(getQuadsWithoutBlankNodes([
      DF.quad(
        DF.quad(
          DF.namedNode('s1'),
          DF.namedNode('p1'),
          DF.namedNode('o1'),
          DF.namedNode('g1'),
        ),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.quad(
          DF.namedNode('s2'),
          DF.namedNode('p2'),
          DF.blankNode('o2'),
          DF.namedNode('g2'),
        ),
        DF.namedNode('p2'),
        DF.namedNode('o2'),
        DF.namedNode('g2'),
      ),
      DF.quad(
        DF.quad(
          DF.namedNode('s3'),
          DF.namedNode('p3'),
          DF.quad(
            DF.namedNode('s3'),
            DF.namedNode('p3'),
            DF.blankNode('o3'),
            DF.namedNode('g3'),
          ),
          DF.namedNode('g3'),
        ),
        DF.namedNode('p3'),
        DF.namedNode('o3'),
        DF.namedNode('g3'),
      ),
    ])).toEqual([
      DF.quad(
        DF.quad(
          DF.namedNode('s1'),
          DF.namedNode('p1'),
          DF.namedNode('o1'),
          DF.namedNode('g1'),
        ),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
    ]);
  });
});

describe('indexGraph', () => {
  it('should index for an empty graph', () => {
    return expect(indexGraph([])).toEqual({});
  });

  it('should index for a graph with one quad', () => {
    return expect(indexGraph([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
    ])).toEqual({
      "{\"subject\":\"s1\",\"predicate\":\"p1\",\"object\":\"o1\",\"graph\":\"g1\"}": true,
    });
  });

  it('should index for a graph with three quads', () => {
    return expect(indexGraph([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.namedNode('s2'),
        DF.namedNode('p2'),
        DF.namedNode('o2'),
        DF.namedNode('g2'),
      ),
      DF.quad(
        DF.namedNode('s3'),
        DF.namedNode('p3'),
        DF.namedNode('o3'),
        DF.namedNode('g3'),
      ),
    ])).toEqual({
      "{\"subject\":\"s1\",\"predicate\":\"p1\",\"object\":\"o1\",\"graph\":\"g1\"}": true,
      "{\"subject\":\"s2\",\"predicate\":\"p2\",\"object\":\"o2\",\"graph\":\"g2\"}": true,
      "{\"subject\":\"s3\",\"predicate\":\"p3\",\"object\":\"o3\",\"graph\":\"g3\"}": true,
    });
  });
});

describe('deindexGraph', () => {
  it('should deindex for an empty graph', () => {
    return expect(deindexGraph({})).toEqual([]);
  });

  it('should deindex for a graph with one quad', () => {
    return expect(deindexGraph({
      "{\"subject\":\"s1\",\"predicate\":\"p1\",\"object\":\"o1\",\"graph\":\"g1\"}": true,
    })).toEqual([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
    ]);
  });

  it('should deindex for a graph with three quads', () => {
    return expect(deindexGraph({
      "{\"subject\":\"s1\",\"predicate\":\"p1\",\"object\":\"o1\",\"graph\":\"g1\"}": true,
      "{\"subject\":\"s2\",\"predicate\":\"p2\",\"object\":\"o2\",\"graph\":\"g2\"}": true,
      "{\"subject\":\"s3\",\"predicate\":\"p3\",\"object\":\"o3\",\"graph\":\"g3\"}": true,
    })).toEqual([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.namedNode('s2'),
        DF.namedNode('p2'),
        DF.namedNode('o2'),
        DF.namedNode('g2'),
      ),
      DF.quad(
        DF.namedNode('s3'),
        DF.namedNode('p3'),
        DF.namedNode('o3'),
        DF.namedNode('g3'),
      ),
    ]);
  });
});

describe('uniqGraph', () => {
  it('should uniqueify for an empty graph', () => {
    return expect(uniqGraph([])).toEqual([]);
  });

  it('should uniqueify for a graph with one quad', () => {
    return expect(uniqGraph([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
    ])).toEqual([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
    ]);
  });

  it('should uniqueify for a graph with two unique quads', () => {
    return expect(uniqGraph([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.namedNode('s2'),
        DF.namedNode('p2'),
        DF.namedNode('o2'),
        DF.namedNode('g2'),
      ),
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
    ])).toEqual([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.namedNode('s2'),
        DF.namedNode('p2'),
        DF.namedNode('o2'),
        DF.namedNode('g2'),
      ),
    ]);
  });
});

describe('getGraphBlankNodes', () => {
  it('should return an empty array for an empty graph', () => {
    return expect(getGraphBlankNodes([])).toEqual([]);
  });

  it('should return an empty array for a graph without blank nodes', () => {
    return expect(getGraphBlankNodes([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.namedNode('s2'),
        DF.namedNode('p2'),
        DF.namedNode('o2'),
        DF.namedNode('g2'),
      ),
    ])).toEqual([]);
  });

  it('should return an non-empty array for a graph with blank nodes', () => {
    return expect(getGraphBlankNodes([
      DF.quad(
        DF.namedNode('s1'),
        DF.namedNode('p1'),
        DF.blankNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.namedNode('s2'),
        DF.namedNode('p2'),
        DF.blankNode('o2'),
        DF.namedNode('g2'),
      ),
    ])).toEqual([
      DF.blankNode('o1'),
      DF.blankNode('o2'),
    ]);
  });

  it('should return an non-empty array for a graph with unique blank nodes', () => {
    return expect(getGraphBlankNodes([
      DF.quad(
        DF.namedNode('s'),
        DF.namedNode('p'),
        DF.blankNode('o'),
        DF.namedNode('g'),
      ),
      DF.quad(
        DF.namedNode('s'),
        DF.namedNode('p'),
        DF.blankNode('o'),
        DF.namedNode('g'),
      ),
    ])).toEqual([
      DF.blankNode('o'),
    ]);
  });

  it('should return an empty array for a graph with nested quads without blank nodes', () => {
    return expect(getGraphBlankNodes([
      DF.quad(
        DF.quad(
          DF.namedNode('s1'),
          DF.namedNode('p1'),
          DF.quad(
            DF.namedNode('s1'),
            DF.namedNode('p1'),
            DF.namedNode('o1'),
            DF.namedNode('g1'),
          ),
          DF.namedNode('g1'),
        ),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.namedNode('s2'),
        DF.namedNode('p2'),
        DF.namedNode('o2'),
        DF.namedNode('g2'),
      ),
    ])).toEqual([]);
  });

  it('should return an empty array for a graph with nested quads with blank nodes', () => {
    return expect(getGraphBlankNodes([
      DF.quad(
        DF.quad(
          DF.namedNode('s1'),
          DF.namedNode('p1'),
          DF.quad(
            DF.namedNode('s1'),
            DF.namedNode('p1'),
            DF.blankNode('o'),
            DF.namedNode('g1'),
          ),
          DF.namedNode('g1'),
        ),
        DF.namedNode('p1'),
        DF.namedNode('o1'),
        DF.namedNode('g1'),
      ),
      DF.quad(
        DF.blankNode('s2'),
        DF.namedNode('p2'),
        DF.blankNode('o'),
        DF.namedNode('g2'),
      ),
    ])).toEqual([
      DF.blankNode('o'),
      DF.blankNode('s2'),
    ]);
  });
});

describe('hashTerms', () => {
  it('should create grounded hashes for a single quad with equal terms and empty hash', () => {
    expect(hashTerms([
      DF.quad(
        DF.blankNode('abc'),
        DF.blankNode('abc'),
        DF.blankNode('abc'),
      ),
    ], [
      DF.blankNode('abc'),
    ], {})).toEqual([
      {
        '_:abc': sha1hex('@self|@self|@self|'),
      },
      {
        '_:abc': sha1hex('@self|@self|@self|'),
      },
    ]);
  });

  it('should create grounded hashes for a two quads with matching bnodes and empty hash', () => {
    expect(hashTerms([
      DF.quad(
        DF.blankNode('abc'),
        DF.namedNode('def1'),
        DF.namedNode('ghi2'),
      ),
      DF.quad(
        DF.blankNode('abc'),
        DF.namedNode('def2'),
        DF.namedNode('ghi2'),
      ),
    ], [
      DF.blankNode('abc'),
    ], {})).toEqual([
      {
        '_:abc': sha1hex('@self|def1|ghi2|@self|def2|ghi2|'),
      },
      {
        '_:abc': sha1hex('@self|def1|ghi2|@self|def2|ghi2|'),
      },
    ]);
  });

  it('should create grounded hashes for a two quads with non-matching bnodes and empty hash', () => {
    expect(hashTerms([
      DF.quad(
        DF.blankNode('abc1'),
        DF.namedNode('def1'),
        DF.namedNode('ghi2'),
      ),
      DF.quad(
        DF.blankNode('abc2'),
        DF.namedNode('def2'),
        DF.namedNode('ghi2'),
      ),
    ], [
      DF.blankNode('abc1'),
    ], {})).toEqual([
      {
        '_:abc1': sha1hex('@self|def1|ghi2|'),
      },
      {
        '_:abc1': sha1hex('@self|def1|ghi2|'),
      },
    ]);
  });

  it('should create grounded hashes for a two nested quads with matching bnodes and empty hash', () => {
    expect(hashTerms([
      DF.quad(
        DF.quad(
          DF.blankNode('abc'),
          DF.namedNode('def1'),
          DF.namedNode('ghi2'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
      DF.quad(
        DF.quad(
          DF.blankNode('abc'),
          DF.namedNode('def2'),
          DF.namedNode('ghi2'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], [
      DF.blankNode('abc'),
    ], {})).toEqual([
      {
        '_:abc': sha1hex('<@self|def1|ghi2|>|def|ghi|<@self|def2|ghi2|>|def|ghi|'),
      },
      {
        '_:abc': sha1hex('<@self|def1|ghi2|>|def|ghi|<@self|def2|ghi2|>|def|ghi|'),
      },
    ]);
  });

  it('should create grounded hashes for a two nested quads with non-matching bnodes and empty hash', () => {
    expect(hashTerms([
      DF.quad(
        DF.quad(
          DF.blankNode('abc1'),
          DF.namedNode('def1'),
          DF.namedNode('ghi2'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
      DF.quad(
        DF.quad(
          DF.blankNode('abc2'),
          DF.namedNode('def2'),
          DF.namedNode('ghi2'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], [
      DF.blankNode('abc1'),
    ], {})).toEqual([
      {
        '_:abc1': sha1hex('<@self|def1|ghi2|>|def|ghi|'),
      },
      {
        '_:abc1': sha1hex('<@self|def1|ghi2|>|def|ghi|'),
      },
    ]);
  });
});

describe('hashTerm', () => {
  it('should return an empty hash for an unrelated quad', () => {
    expect(hashTerm(DF.namedNode('abc'), [
      DF.quad(
        DF.namedNode('def'),
        DF.namedNode('def'),
        DF.namedNode('def'),
      ),
    ], {})).toEqual([true, sha1hex('')]);
  });

  it('should create grounded hashes for a single quad with equal terms', () => {
    expect(hashTerm(DF.namedNode('abc'), [
      DF.quad(
        DF.namedNode('abc'),
        DF.namedNode('abc'),
        DF.namedNode('abc'),
      ),
    ], {})).toEqual([true, sha1hex('@self|@self|@self|')]);
  });

  it('should create grounded hashes for a single quad with different terms', () => {
    expect(hashTerm(DF.namedNode('abc'), [
      DF.quad(
        DF.namedNode('abc'),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], {})).toEqual([true, sha1hex('@self|def|ghi|')]);
  });

  it('should create grounded hashes for a single quad that has the a blank node that is not hashed', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.blankNode('abc'),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], {})).toEqual([true, sha1hex('@self|def|ghi|')]);
  });

  it('should create grounded hashes for a single quad with an external blank node', () => {
    expect(hashTerm(DF.blankNode('notinquad'), [
      DF.quad(
        DF.blankNode('abc'),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], {})).toEqual([true, sha1hex('')]);
  });

  it('should create ungrounded hashes for a single quad with the blank node that is not hashed but also ' +
    'has another non-hashed blank node', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.blankNode('abc'),
        DF.blankNode('def'),
        DF.namedNode('ghi'),
      ),
    ], {})).toEqual([false, sha1hex('@self|@blank|ghi|')]);
  });

  it('should create ungrounded hashes for a two quads with the same blank node that is not hashed but also ' +
    'has another non-hashed blank node', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.blankNode('abc'),
        DF.blankNode('def1'),
        DF.namedNode('ghi1'),
      ),
      DF.quad(
        DF.blankNode('abc'),
        DF.blankNode('def2'),
        DF.namedNode('ghi2'),
      ),
    ], {})).toEqual([false, sha1hex('@self|@blank|ghi1|@self|@blank|ghi2|')]);
  });

  it('should create ungrounded hashes for a two quads, one with the same blank node, and one with another ' +
    'that is not hashed but also has another non-hashed blank node', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.blankNode('abc'),
        DF.blankNode('def1'),
        DF.namedNode('ghi1'),
      ),
      DF.quad(
        DF.blankNode('other'),
        DF.blankNode('def2'),
        DF.namedNode('ghi2'),
      ),
    ], {})).toEqual([false, sha1hex('@self|@blank|ghi1|')]);
  });

  it('should create grounded hashes for a single quad with the blank node that is not hashed but also ' +
    'has another hashed blank node', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.blankNode('abc'),
        DF.blankNode('def'),
        DF.namedNode('ghi'),
      ),
    ], { '_:def': 'DEF' })).toEqual([true, sha1hex('@self|DEF|ghi|')]);
  });

  it('should create grounded hashes for a single quad2 with the blank node that is not hashed but also ' +
    'has another hashed blank node', () => {
    expect(hashTerm(DF.blankNode('def'), [
      DF.quad(
        DF.blankNode('abc'),
        DF.blankNode('def'),
        DF.namedNode('ghi'),
      ),
    ], { '_:abc': 'ABC' })).toEqual([true, sha1hex('ABC|@self|ghi|')]);
  });

  it('should return an empty hash for an unrelated nested quad', () => {
    expect(hashTerm(DF.namedNode('abc'), [
      DF.quad(
        DF.quad(
          DF.namedNode('def'),
          DF.namedNode('def'),
          DF.namedNode('def'),
        ),
        DF.namedNode('def'),
        DF.namedNode('def'),
      ),
    ], {})).toEqual([true, sha1hex('')]);
  });

  it('should create grounded hashes for a single nested quad with equal terms', () => {
    expect(hashTerm(DF.namedNode('abc'), [
      DF.quad(
        DF.quad(
          DF.namedNode('abc'),
          DF.namedNode('abc'),
          DF.namedNode('abc'),
        ),
        DF.namedNode('abc'),
        DF.namedNode('abc'),
      ),
    ], {})).toEqual([true, sha1hex('<@self|@self|@self|>|@self|@self|')]);
  });

  it('should create grounded hashes for a single nested quad with different terms', () => {
    expect(hashTerm(DF.namedNode('abc'), [
      DF.quad(
        DF.quad(
          DF.namedNode('abc'),
          DF.namedNode('def'),
          DF.namedNode('ghi'),
        ),
        DF.namedNode('abc'),
        DF.namedNode('abc'),
      ),
    ], {})).toEqual([true, sha1hex('<@self|def|ghi|>|@self|@self|')]);
  });

  it('should create grounded hashes for a single nested quad that has the blank node that is not hashed', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.quad(
          DF.blankNode('abc'),
          DF.namedNode('def'),
          DF.namedNode('ghi'),
        ),
        DF.blankNode('abc'),
        DF.blankNode('abc'),
      ),
    ], {})).toEqual([true, sha1hex('<@self|def|ghi|>|@self|@self|')]);
  });

  it('should create grounded hashes for a single nested quad that has the blank node (only in nested) that is not hashed', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.quad(
          DF.blankNode('abc'),
          DF.namedNode('def'),
          DF.namedNode('ghi'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], {})).toEqual([true, sha1hex('<@self|def|ghi|>|def|ghi|')]);
  });

  it('should create ungrounded hashes for a single nested quad with the blank node that is not hashed but also ' +
    'has another non-hashed blank node', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.quad(
          DF.blankNode('abc'),
          DF.blankNode('def'),
          DF.namedNode('ghi'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], {})).toEqual([false, sha1hex('<@self|@blank|ghi|>|def|ghi|')]);
  });

  it('should create ungrounded hashes for a two nested quads with the same blank node that is not hashed but also ' +
    'has another non-hashed blank node', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.quad(
          DF.blankNode('abc'),
          DF.blankNode('def1'),
          DF.namedNode('ghi1'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
      DF.quad(
        DF.quad(
          DF.blankNode('abc'),
          DF.blankNode('def2'),
          DF.namedNode('ghi2'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], {})).toEqual([false, sha1hex('<@self|@blank|ghi1|>|def|ghi|<@self|@blank|ghi2|>|def|ghi|')]);
  });

  it('should create ungrounded hashes for a two nested quads, one with the same blank node, and one with another ' +
    'that is not hashed but also has another non-hashed blank node', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.quad(
          DF.blankNode('abc'),
          DF.blankNode('def1'),
          DF.namedNode('ghi1'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
      DF.quad(
        DF.quad(
          DF.blankNode('other'),
          DF.blankNode('def2'),
          DF.namedNode('ghi2'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], {})).toEqual([false, sha1hex('<@self|@blank|ghi1|>|def|ghi|')]);
  });

  it('should create grounded hashes for a single nested quad with the blank node that is not hashed but also ' +
    'has another hashed blank node', () => {
    expect(hashTerm(DF.blankNode('abc'), [
      DF.quad(
        DF.quad(
          DF.blankNode('abc'),
          DF.blankNode('def'),
          DF.namedNode('ghi'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], { '_:def': 'DEF' })).toEqual([true, sha1hex('<@self|DEF|ghi|>|def|ghi|')]);
  });

  it('should create grounded hashes for a single nested quad2 with the blank node that is not hashed but also ' +
    'has another hashed blank node', () => {
    expect(hashTerm(DF.blankNode('def'), [
      DF.quad(
        DF.quad(
          DF.blankNode('abc'),
          DF.blankNode('def'),
          DF.namedNode('ghi'),
        ),
        DF.namedNode('def'),
        DF.namedNode('ghi'),
      ),
    ], { '_:abc': 'ABC' })).toEqual([true, sha1hex('<ABC|@self|ghi|>|def|ghi|')]);
  });
});

describe('sha1hex', () => {
  it('should create hashes', () => {
    expect(sha1hex('aaa')).toEqual('7e240de74fb1ed08fa08d38063f6a6a91462a815');
  });
});

describe('quadToSignature', () => {
  it('should concat calls to termToSignature for all terms', () => {
    return expect(quadToSignature(DF.quad(
      DF.namedNode('abc'),
      DF.namedNode('pred'),
      DF.blankNode('abc'),
      DF.defaultGraph(),
    ), { '_:abc': 'aaa' }, DF.namedNode('abc'))).toEqual('@self|pred|aaa|');
  });
});

describe('termToSignature', () => {
  it('should be @self for equal terms', () => {
    return expect(termToSignature(DF.namedNode('abc'), {}, DF.namedNode('abc'))).toEqual('@self');
  });

  it('should be @self for equal blank terms', () => {
    return expect(termToSignature(DF.blankNode('abc'), {}, DF.blankNode('abc'))).toEqual('@self');
  });

  it('should be the node string for non-equal non-blank terms', () => {
    return expect(termToSignature(DF.namedNode('abc'), {}, DF.namedNode('def'))).toEqual('abc');
  });

  it('should be @blank for non-equal blank terms that are not hashed yet', () => {
    return expect(termToSignature(DF.blankNode('abc'), {}, DF.blankNode('def'))).toEqual('@blank');
  });

  it('should be the hash for non-equal blank terms that are hashed yet', () => {
    return expect(termToSignature(DF.blankNode('abc'), { '_:abc': 'aaa' }, DF.blankNode('def')))
      .toEqual('aaa');
  });

  it('should be @self for equal quads', () => {
    return expect(termToSignature(DF.quad(
      DF.namedNode('s'),
      DF.namedNode('p'),
      DF.blankNode('abc'),
      DF.namedNode('g'),
    ), {}, DF.quad(
      DF.namedNode('s'),
      DF.namedNode('p'),
      DF.blankNode('abc'),
      DF.namedNode('g'),
    ))).toEqual('@self');
  });

  it('should be the node string for non-equal quads with no blank nodes', () => {
    return expect(termToSignature(DF.quad(
      DF.namedNode('s'),
      DF.namedNode('p'),
      DF.namedNode('o'),
      DF.namedNode('g'),
    ), {}, DF.quad(
      DF.namedNode('s2'),
      DF.namedNode('p2'),
      DF.namedNode('o2'),
      DF.namedNode('g2'),
    ))).toEqual('<s|p|o|g>');
  });

  it('should contain @blank for non-equal quads with blank nodes that are not hashed yet', () => {
    return expect(termToSignature(DF.quad(
      DF.namedNode('s'),
      DF.namedNode('p'),
      DF.blankNode('abc'),
      DF.namedNode('g'),
    ), {}, DF.quad(
      DF.namedNode('s2'),
      DF.namedNode('p2'),
      DF.namedNode('o2'),
      DF.namedNode('g2'),
    ))).toEqual('<s|p|@blank|g>');
  });

  it('should contain be the hash for non-equal quads with blank nodes that are hashed yet', () => {
    return expect(termToSignature(DF.quad(
      DF.namedNode('s'),
      DF.namedNode('p'),
      DF.blankNode('abc'),
      DF.namedNode('g'),
    ), { '_:abc': 'aaa' }, DF.quad(
      DF.namedNode('s2'),
      DF.namedNode('p2'),
      DF.namedNode('o2'),
      DF.namedNode('g2'),
    ))).toEqual('<s|p|aaa|g>');
  });
});

describe('isTermGrounded', () => {
  it('should be true for Named Nodes', () => {
    return expect(isTermGrounded(DF.namedNode('abc'), {})).toBeTruthy();
  });

  it('should be true for Literals', () => {
    return expect(isTermGrounded(DF.literal('abc'), {})).toBeTruthy();
  });

  it('should be true for Variables', () => {
    return expect(isTermGrounded(DF.variable('abc'), {})).toBeTruthy();
  });

  it('should be true for Default Graphs', () => {
    return expect(isTermGrounded(DF.defaultGraph(), {})).toBeTruthy();
  });

  it('should be false for blank nodes that are not included in the hash', () => {
    return expect(isTermGrounded(DF.blankNode('abc'), { xyz: 'aaa' })).toBeFalsy();
  });

  it('should be true for blank nodes that are included in the hash', () => {
    return expect(isTermGrounded(DF.blankNode('abc'), { '_:abc': 'aaa' })).toBeTruthy();
  });

  it('should be true for nested quads without blank nodes', () => {
    return expect(isTermGrounded(DF.quad(
      DF.quad(
        DF.namedNode('s'),
        DF.namedNode('p'),
        DF.namedNode('o'),
        DF.namedNode('g'),
      ),
      DF.namedNode('p'),
      DF.namedNode('o'),
      DF.namedNode('g'),
    ), {})).toBeTruthy();
  });

  it('should be false for nested quads with a blank node not included in the hash', () => {
    return expect(isTermGrounded(DF.quad(
      DF.quad(
        DF.namedNode('s'),
        DF.namedNode('p'),
        DF.blankNode('abc'),
        DF.namedNode('g'),
      ),
      DF.namedNode('p'),
      DF.namedNode('o'),
      DF.namedNode('g'),
    ), { xyz: 'aaa' })).toBeFalsy();
  });

  it('should be false for nested quads with multiple blank nodes not included in the hash', () => {
    return expect(isTermGrounded(DF.quad(
      DF.quad(
        DF.namedNode('s'),
        DF.namedNode('p'),
        DF.blankNode('abc'),
        DF.namedNode('g'),
      ),
      DF.namedNode('p'),
      DF.blankNode('def'),
      DF.namedNode('g'),
    ), { xyz: 'aaa' })).toBeFalsy();
  });

  it('should be true for nested quads with a blank node included in the hash', () => {
    return expect(isTermGrounded(DF.quad(
      DF.quad(
        DF.namedNode('s'),
        DF.namedNode('p'),
        DF.blankNode('abc'),
        DF.namedNode('g'),
      ),
      DF.namedNode('p'),
      DF.namedNode('o'),
      DF.namedNode('g'),
    ), { '_:abc': 'aaa' })).toBeTruthy();
  });

  it('should be true for nested quads with multiple blank nodes included in the hash', () => {
    return expect(isTermGrounded(DF.quad(
      DF.quad(
        DF.namedNode('s'),
        DF.namedNode('p'),
        DF.blankNode('abc'),
        DF.namedNode('g'),
      ),
      DF.namedNode('p'),
      DF.blankNode('def'),
      DF.namedNode('g'),
    ), { '_:abc': 'aaa', '_:def': 'aaa' })).toBeTruthy();
  });

  it('should be false for nested quads with multiple nested blank nodes not included in the hash', () => {
    return expect(isTermGrounded(DF.quad(
      DF.quad(
        DF.namedNode('s'),
        DF.namedNode('p'),
        DF.blankNode('abc'),
        DF.blankNode('def'),
      ),
      DF.namedNode('p'),
      DF.namedNode('o'),
      DF.namedNode('g'),
    ), { '_:abc': 'aaa' })).toBeFalsy();
  });

  it('should be true for nested quads with multiple nested blank nodes included in the hash', () => {
    return expect(isTermGrounded(DF.quad(
      DF.quad(
        DF.namedNode('s'),
        DF.namedNode('p'),
        DF.blankNode('abc'),
        DF.blankNode('def'),
      ),
      DF.namedNode('p'),
      DF.namedNode('o'),
      DF.namedNode('g'),
    ), { '_:abc': 'aaa', '_:def': 'aaa' })).toBeTruthy();
  });
});
