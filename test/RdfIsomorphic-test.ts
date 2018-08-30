import * as DataFactory from "@rdfjs/data-model";
import {createReadStream, readdirSync} from "fs";
import {StreamParser} from 'n3';
import * as RDF from "rdf-js";
import {
  getGraphBlankNodes, getQuadsWithBlankNodes, getQuadsWithoutBlankNodes,
  hashTerm,
  hashTerms, hashValues, hasValue, indexGraph,
  isomorphic,
  isTermGrounded,
  quadToSignature,
  sha1hex,
  termToSignature,
} from "../lib/RdfIsomorphic";
// tslint:disable-next-line:no-var-requires
const arrayifyStream = require('arrayify-stream');

describe('isomorphic', () => {
  loadIsomorphicFiles(__dirname + '/assets/isomorphic/', true);
  loadIsomorphicFiles(__dirname + '/assets/non_isomorphic/', false);

  describe('for pathological cases', () => {
    /* These cases are not possible in practise, as RDF does not allow blank predicates. */
    it('should be isomorphic for 2 graphs with single full-blank triples', () => {
      const graphA = [
        DataFactory.quad(
          DataFactory.blankNode('a1'),
          DataFactory.blankNode('b1'),
          DataFactory.blankNode('c1'),
        ),
      ];
      const graphB = [
        DataFactory.quad(
          DataFactory.blankNode('a2'),
          DataFactory.blankNode('b2'),
          DataFactory.blankNode('c2'),
        ),
      ];
      return expect(isomorphic(graphA, graphB)).toBe(true);
    });

    it('should be isomorphic for 2 graphs with two unconnected full-blank triples', () => {
      const graphA = [
        DataFactory.quad(
          DataFactory.blankNode('a1'),
          DataFactory.blankNode('b1'),
          DataFactory.blankNode('c1'),
        ),
        DataFactory.quad(
          DataFactory.blankNode('d1'),
          DataFactory.blankNode('e1'),
          DataFactory.blankNode('f1'),
        ),
      ];
      const graphB = [
        DataFactory.quad(
          DataFactory.blankNode('a2'),
          DataFactory.blankNode('b2'),
          DataFactory.blankNode('c2'),
        ),
        DataFactory.quad(
          DataFactory.blankNode('d2'),
          DataFactory.blankNode('e2'),
          DataFactory.blankNode('f2'),
        ),
      ];
      return expect(isomorphic(graphA, graphB)).toBe(true);
    });

    it('should be isomorphic for 2 graphs with two connected full-blank triples', () => {
      const graphA = [
        DataFactory.quad(
          DataFactory.blankNode('a1'),
          DataFactory.blankNode('b1'),
          DataFactory.blankNode('c1'),
        ),
        DataFactory.quad(
          DataFactory.blankNode('c1'),
          DataFactory.blankNode('e1'),
          DataFactory.blankNode('f1'),
        ),
      ];
      const graphB = [
        DataFactory.quad(
          DataFactory.blankNode('a2'),
          DataFactory.blankNode('b2'),
          DataFactory.blankNode('c2'),
        ),
        DataFactory.quad(
          DataFactory.blankNode('c2'),
          DataFactory.blankNode('e2'),
          DataFactory.blankNode('f2'),
        ),
      ];
      return expect(isomorphic(graphA, graphB)).toBe(true);
    });

    it('should be isomorphic for 2 graphs with two connected partially-blank triples', () => {
      const graphA = [
        DataFactory.quad(
          DataFactory.namedNode('a1'),
          DataFactory.blankNode('b1'),
          DataFactory.blankNode('c1'),
        ),
        DataFactory.quad(
          DataFactory.blankNode('c1'),
          DataFactory.blankNode('e1'),
          DataFactory.blankNode('f1'),
        ),
      ];
      const graphB = [
        DataFactory.quad(
          DataFactory.namedNode('a1'),
          DataFactory.blankNode('b2'),
          DataFactory.blankNode('c2'),
        ),
        DataFactory.quad(
          DataFactory.blankNode('c2'),
          DataFactory.blankNode('e2'),
          DataFactory.blankNode('f2'),
        ),
      ];
      return expect(isomorphic(graphA, graphB)).toBe(true);
    });

    it('should not be isomorphic for 2 graphs with single full-blank triples', () => {
      const graphA = [
        DataFactory.quad(
          DataFactory.blankNode('a1'),
          DataFactory.blankNode('b1'),
          DataFactory.blankNode('a1'),
        ),
      ];
      const graphB = [
        DataFactory.quad(
          DataFactory.blankNode('a2'),
          DataFactory.blankNode('b2'),
          DataFactory.blankNode('c2'),
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
      DataFactory.quad(
        DataFactory.namedNode('s1'),
        DataFactory.namedNode('p1'),
        DataFactory.namedNode('o1'),
        DataFactory.namedNode('g1'),
      ),
      DataFactory.quad(
        DataFactory.namedNode('s2'),
        DataFactory.namedNode('p2'),
        DataFactory.blankNode('o2'),
        DataFactory.namedNode('g2'),
      ),
      DataFactory.quad(
        DataFactory.namedNode('s3'),
        DataFactory.namedNode('p3'),
        DataFactory.namedNode('o3'),
        DataFactory.namedNode('g3'),
      ),
    ])).toEqual([
      DataFactory.quad(
        DataFactory.namedNode('s2'),
        DataFactory.namedNode('p2'),
        DataFactory.blankNode('o2'),
        DataFactory.namedNode('g2'),
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
      DataFactory.quad(
        DataFactory.namedNode('s1'),
        DataFactory.namedNode('p1'),
        DataFactory.namedNode('o1'),
        DataFactory.namedNode('g1'),
      ),
      DataFactory.quad(
        DataFactory.namedNode('s2'),
        DataFactory.namedNode('p2'),
        DataFactory.blankNode('o2'),
        DataFactory.namedNode('g2'),
      ),
      DataFactory.quad(
        DataFactory.namedNode('s3'),
        DataFactory.namedNode('p3'),
        DataFactory.namedNode('o3'),
        DataFactory.namedNode('g3'),
      ),
    ])).toEqual([
      DataFactory.quad(
        DataFactory.namedNode('s1'),
        DataFactory.namedNode('p1'),
        DataFactory.namedNode('o1'),
        DataFactory.namedNode('g1'),
      ),
      DataFactory.quad(
        DataFactory.namedNode('s3'),
        DataFactory.namedNode('p3'),
        DataFactory.namedNode('o3'),
        DataFactory.namedNode('g3'),
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
      DataFactory.quad(
        DataFactory.namedNode('s1'),
        DataFactory.namedNode('p1'),
        DataFactory.namedNode('o1'),
        DataFactory.namedNode('g1'),
      ),
    ])).toEqual({
      "{\"subject\":\"s1\",\"predicate\":\"p1\",\"object\":\"o1\",\"graph\":\"g1\"}": true,
    });
  });

  it('should index for a graph with three quads', () => {
    return expect(indexGraph([
      DataFactory.quad(
        DataFactory.namedNode('s1'),
        DataFactory.namedNode('p1'),
        DataFactory.namedNode('o1'),
        DataFactory.namedNode('g1'),
      ),
      DataFactory.quad(
        DataFactory.namedNode('s2'),
        DataFactory.namedNode('p2'),
        DataFactory.namedNode('o2'),
        DataFactory.namedNode('g2'),
      ),
      DataFactory.quad(
        DataFactory.namedNode('s3'),
        DataFactory.namedNode('p3'),
        DataFactory.namedNode('o3'),
        DataFactory.namedNode('g3'),
      ),
    ])).toEqual({
      "{\"subject\":\"s1\",\"predicate\":\"p1\",\"object\":\"o1\",\"graph\":\"g1\"}": true,
      "{\"subject\":\"s2\",\"predicate\":\"p2\",\"object\":\"o2\",\"graph\":\"g2\"}": true,
      "{\"subject\":\"s3\",\"predicate\":\"p3\",\"object\":\"o3\",\"graph\":\"g3\"}": true,
    });
  });
});

describe('getGraphBlankNodes', () => {
  it('should return an empty array for an empty graph', () => {
    return expect(getGraphBlankNodes([])).toEqual([]);
  });

  it('should return an empty array for a graph without blank nodes', () => {
    return expect(getGraphBlankNodes([
      DataFactory.quad(
        DataFactory.namedNode('s1'),
        DataFactory.namedNode('p1'),
        DataFactory.namedNode('o1'),
        DataFactory.namedNode('g1'),
      ),
      DataFactory.quad(
        DataFactory.namedNode('s2'),
        DataFactory.namedNode('p2'),
        DataFactory.namedNode('o2'),
        DataFactory.namedNode('g2'),
      ),
    ])).toEqual([]);
  });

  it('should return an non-empty array for a graph with blank nodes', () => {
    return expect(getGraphBlankNodes([
      DataFactory.quad(
        DataFactory.namedNode('s1'),
        DataFactory.namedNode('p1'),
        DataFactory.blankNode('o1'),
        DataFactory.namedNode('g1'),
      ),
      DataFactory.quad(
        DataFactory.namedNode('s2'),
        DataFactory.namedNode('p2'),
        DataFactory.blankNode('o2'),
        DataFactory.namedNode('g2'),
      ),
    ])).toEqual([
      DataFactory.blankNode('o1'),
      DataFactory.blankNode('o2'),
    ]);
  });

  it('should return an non-empty array for a graph with unique blank nodes', () => {
    return expect(getGraphBlankNodes([
      DataFactory.quad(
        DataFactory.namedNode('s'),
        DataFactory.namedNode('p'),
        DataFactory.blankNode('o'),
        DataFactory.namedNode('g'),
      ),
      DataFactory.quad(
        DataFactory.namedNode('s'),
        DataFactory.namedNode('p'),
        DataFactory.blankNode('o'),
        DataFactory.namedNode('g'),
      ),
    ])).toEqual([
      DataFactory.blankNode('o'),
    ]);
  });
});

describe('hashTerms', () => {
  it('should create grounded hashes for a single quad with equal terms and empty hash', () => {
    expect(hashTerms([
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.blankNode('abc'),
        DataFactory.blankNode('abc'),
      ),
    ], [
      DataFactory.blankNode('abc'),
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
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.namedNode('def1'),
        DataFactory.namedNode('ghi2'),
      ),
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.namedNode('def2'),
        DataFactory.namedNode('ghi2'),
      ),
    ], [
      DataFactory.blankNode('abc'),
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
      DataFactory.quad(
        DataFactory.blankNode('abc1'),
        DataFactory.namedNode('def1'),
        DataFactory.namedNode('ghi2'),
      ),
      DataFactory.quad(
        DataFactory.blankNode('abc2'),
        DataFactory.namedNode('def2'),
        DataFactory.namedNode('ghi2'),
      ),
    ], [
      DataFactory.blankNode('abc1'),
    ], {})).toEqual([
      {
        '_:abc1': sha1hex('@self|def1|ghi2|'),
      },
      {
        '_:abc1': sha1hex('@self|def1|ghi2|'),
      },
    ]);
  });
});

describe('hashTerm', () => {
  it('should create grounded hashes for a single quad with equal terms', () => {
    expect(hashTerm(DataFactory.namedNode('abc'), [
      DataFactory.quad(
        DataFactory.namedNode('abc'),
        DataFactory.namedNode('abc'),
        DataFactory.namedNode('abc'),
      ),
    ], {})).toEqual([true, sha1hex('@self|@self|@self|')]);
  });

  it('should create grounded hashes for a single quad with different terms', () => {
    expect(hashTerm(DataFactory.namedNode('abc'), [
      DataFactory.quad(
        DataFactory.namedNode('abc'),
        DataFactory.namedNode('def'),
        DataFactory.namedNode('ghi'),
      ),
    ], {})).toEqual([true, sha1hex('@self|def|ghi|')]);
  });

  it('should create grounded hashes for a single quad that has the a blank node that is not hashed', () => {
    expect(hashTerm(DataFactory.blankNode('abc'), [
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.namedNode('def'),
        DataFactory.namedNode('ghi'),
      ),
    ], {})).toEqual([true, sha1hex('@self|def|ghi|')]);
  });

  it('should create grounded hashes for a single quad with an external blank node', () => {
    expect(hashTerm(DataFactory.blankNode('notinquad'), [
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.namedNode('def'),
        DataFactory.namedNode('ghi'),
      ),
    ], {})).toEqual([true, sha1hex('')]);
  });

  it('should create ungrounded hashes for a single quad with the blank node that is not hashed but also ' +
    'has another non-hashed blank node', () => {
    expect(hashTerm(DataFactory.blankNode('abc'), [
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.blankNode('def'),
        DataFactory.namedNode('ghi'),
      ),
    ], {})).toEqual([false, sha1hex('@self|@blank|ghi|')]);
  });

  it('should create ungrounded hashes for a two quads with the same blank node that is not hashed but also ' +
    'has another non-hashed blank node', () => {
    expect(hashTerm(DataFactory.blankNode('abc'), [
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.blankNode('def1'),
        DataFactory.namedNode('ghi1'),
      ),
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.blankNode('def2'),
        DataFactory.namedNode('ghi2'),
      ),
    ], {})).toEqual([false, sha1hex('@self|@blank|ghi1|@self|@blank|ghi2|')]);
  });

  it('should create ungrounded hashes for a two quads, one with the same blank node, and one with another ' +
    'that is not hashed but also has another non-hashed blank node', () => {
    expect(hashTerm(DataFactory.blankNode('abc'), [
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.blankNode('def1'),
        DataFactory.namedNode('ghi1'),
      ),
      DataFactory.quad(
        DataFactory.blankNode('other'),
        DataFactory.blankNode('def2'),
        DataFactory.namedNode('ghi2'),
      ),
    ], {})).toEqual([false, sha1hex('@self|@blank|ghi1|')]);
  });

  it('should create grounded hashes for a single quad with the blank node that is not hashed but also ' +
    'has another hashed blank node', () => {
    expect(hashTerm(DataFactory.blankNode('abc'), [
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.blankNode('def'),
        DataFactory.namedNode('ghi'),
      ),
    ], { '_:def': 'DEF' })).toEqual([true, sha1hex('@self|DEF|ghi|')]);
  });

  it('should create grounded hashes for a single quad2 with the blank node that is not hashed but also ' +
    'has another hashed blank node', () => {
    expect(hashTerm(DataFactory.blankNode('def'), [
      DataFactory.quad(
        DataFactory.blankNode('abc'),
        DataFactory.blankNode('def'),
        DataFactory.namedNode('ghi'),
      ),
    ], { '_:abc': 'ABC' })).toEqual([true, sha1hex('ABC|@self|ghi|')]);
  });
});

describe('sha1hex', () => {
  it('should create hashes', () => {
    expect(sha1hex('aaa')).toEqual('7e240de74fb1ed08fa08d38063f6a6a91462a815');
  });
});

describe('quadToSignature', () => {
  it('should concat calls to termToSignature for all terms', () => {
    return expect(quadToSignature(DataFactory.quad(
      DataFactory.namedNode('abc'),
      DataFactory.namedNode('pred'),
      DataFactory.blankNode('abc'),
      DataFactory.defaultGraph(),
    ), { '_:abc': 'aaa' }, DataFactory.namedNode('abc'))).toEqual('@self|pred|aaa|');
  });
});

describe('termToSignature', () => {
  it('should be @self for equal terms', () => {
    return expect(termToSignature(DataFactory.namedNode('abc'), {}, DataFactory.namedNode('abc'))).toEqual('@self');
  });

  it('should be @self for equal blank terms', () => {
    return expect(termToSignature(DataFactory.blankNode('abc'), {}, DataFactory.blankNode('abc'))).toEqual('@self');
  });

  it('should be the node string for non-equal non-blank terms', () => {
    return expect(termToSignature(DataFactory.namedNode('abc'), {}, DataFactory.namedNode('def'))).toEqual('abc');
  });

  it('should be @blank for non-equal blank terms that are not hashed yet', () => {
    return expect(termToSignature(DataFactory.blankNode('abc'), {}, DataFactory.blankNode('def'))).toEqual('@blank');
  });

  it('should be the hash for non-equal blank terms that are hashed yet', () => {
    return expect(termToSignature(DataFactory.blankNode('abc'), { '_:abc': 'aaa' }, DataFactory.blankNode('def')))
      .toEqual('aaa');
  });
});

describe('isTermGrounded', () => {
  it('should be true for Named Nodes', () => {
    return expect(isTermGrounded(DataFactory.namedNode('abc'), {})).toBeTruthy();
  });

  it('should be true for Literals', () => {
    return expect(isTermGrounded(DataFactory.literal('abc'), {})).toBeTruthy();
  });

  it('should be true for Variables', () => {
    return expect(isTermGrounded(DataFactory.variable('abc'), {})).toBeTruthy();
  });

  it('should be true for Default Graphs', () => {
    return expect(isTermGrounded(DataFactory.defaultGraph(), {})).toBeTruthy();
  });

  it('should be false for blank nodes that are not included in the hash', () => {
    return expect(isTermGrounded(DataFactory.blankNode('abc'), { xyz: 'aaa' })).toBeFalsy();
  });

  it('should be true for blank nodes that are not included in the hash', () => {
    return expect(isTermGrounded(DataFactory.blankNode('abc'), { '_:abc': 'aaa' })).toBeTruthy();
  });
});
