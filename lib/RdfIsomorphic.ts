import type * as RDF from '@rdfjs/types';
import murmurHash3 from 'imurmurhash';
import type { IStringQuad } from 'rdf-string';
import { quadToStringQuad, stringQuadToQuad, termToString } from 'rdf-string';
import { everyTerms, getBlankNodes, getTerms, someTerms, uniqTerms, getTermsNested } from 'rdf-terms';

/**
 * Determines if the two given graphs are isomorphic.
 *
 * @param {Quad[]} graphA An array of quads, order is not important.
 * @param {Quad[]} graphB An array of quads, order is not important.
 * @return {boolean} If the two given graphs are isomorphic.
 */
export function isomorphic<TQ extends RDF.BaseQuad = RDF.Quad>(graphA: TQ[], graphB: TQ[]): boolean {
  return Boolean(getBijection(graphA, graphB));
}

/**
 * Calculate a hash of graphA blank nodes to graphB blank nodes.
 * This represents a bijection from graphA's blank nodes to graphB's blank nodes.
 *
 * @param {Quad[]} graphA An array of quads, order is not important.
 * @param {Quad[]} graphB An array of quads, order is not important.
 * @return {IBijection} A hash representing a bijection, or null if none could be found.
 */
export function getBijection<TQ extends RDF.BaseQuad = RDF.Quad>(graphA: TQ[], graphB: TQ[]): IBijection | null {
  // Check if all (non-blanknode-containing) quads in the two graphs are equal.
  // We do this by creating a hash-based index for both graphs.
  const nonBlankIndexA: Record<string, boolean> = indexGraph(getQuadsWithoutBlankNodes(graphA));
  const nonBlankIndexB: Record<string, boolean> = indexGraph(getQuadsWithoutBlankNodes(graphB));
  if (Object.keys(nonBlankIndexA).length !== Object.keys(nonBlankIndexB).length) {
    return null;
  }
  for (const key in nonBlankIndexA) {
    if (nonBlankIndexA[key] !== nonBlankIndexB[key]) {
      return null;
    }
  }

  // Pre-process data that needs to be present in each iteration of getBijectionInner.
  const blankQuadsA: TQ[] = uniqGraph(getQuadsWithBlankNodes(graphA));
  const blankQuadsB: TQ[] = uniqGraph(getQuadsWithBlankNodes(graphB));
  const blankNodesA: RDF.BlankNode[] = getGraphBlankNodes(graphA);
  const blankNodesB: RDF.BlankNode[] = getGraphBlankNodes(graphB);

  return getBijectionInner(blankQuadsA, blankQuadsB, blankNodesA, blankNodesB);
}

export function getBijectionInner<TQ extends RDF.BaseQuad = RDF.Quad>(
  blankQuadsA: TQ[],
  blankQuadsB: TQ[],
  blankNodesA: RDF.BlankNode[],
  blankNodesB: RDF.BlankNode[],
  groundedHashesA?: ITermHash,
  groundedHashesB?: ITermHash,
): IBijection | null {
  if (!groundedHashesA) {
    groundedHashesA = {};
  }
  if (!groundedHashesB) {
    groundedHashesB = {};
  }

  // Hash every term based on the signature of the quads if appears in.
  const [ hashesA, ungroundedHashesA ] = hashTerms(blankQuadsA, blankNodesA, groundedHashesA);
  const [ hashesB, ungroundedHashesB ] = hashTerms(blankQuadsB, blankNodesB, groundedHashesB);

  // Break quickly if the graphs do not contain the same grounded node hashes.
  const groundedValuesA: number[] = Object.values(hashesA).sort((a, b) => a - b);
  const groundedValuesB: number[] = Object.values(hashesB).sort((a, b) => a - b);
  if (blankNodesA.length !== blankNodesB.length || !arraysEqual(groundedValuesA, groundedValuesB)) {
    return null;
  }

  // Map the blank nodes from graph A to the blank nodes of graph B using the grounded hashes.
  // Only hashes that occur once in each graph identify a single node.
  const groundedCountsA: Map<number, number> = countValues(hashesA);
  const bijection: IBijection = {};
  const unmappedA: string[] = [];
  const unmappedB: Set<string> = new Set(blankNodesB.map(termToString));
  for (const blankNodeA of blankNodesA) {
    const blankNodeAString: string = termToString(blankNodeA);
    const hash: number | undefined = hashesA[blankNodeAString];
    if (hash !== undefined && groundedCountsA.get(hash) === 1) {
      const blankNodeBString: string = Object.keys(hashesB).find(key => hashesB[key] === hash)!;
      bijection[blankNodeAString] = blankNodeBString;
      unmappedB.delete(blankNodeBString);
    } else {
      unmappedA.push(blankNodeAString);
    }
  }

  // If all nodes are mapped, the bijection is only valid if it maps every quad of graph A onto graph B.
  if (unmappedA.length === 0) {
    return isBijectionValid(bijection, blankQuadsA, blankQuadsB) ? bijection : null;
  }

  // Otherwise, speculatively mark the first unmapped node of graph A as bijected
  // with each unmapped node of graph B that has the same hash, and recurse.
  // That node must map to one of these candidates, so if none of them works, there is no bijection.
  const blankNodeAString: string = unmappedA[0];
  const blankNodeAHash: number = hashesA[blankNodeAString] ?? ungroundedHashesA[blankNodeAString];
  const hash: number = hashNumber(blankNodeAString);
  for (const blankNodeBString of unmappedB) {
    const blankNodeBHash: number = hashesB[blankNodeBString] ?? ungroundedHashesB[blankNodeBString];
    if (blankNodeAHash === blankNodeBHash) {
      const result: IBijection | null = getBijectionInner(
        blankQuadsA,
        blankQuadsB,
        blankNodesA,
        blankNodesB,
        { ...hashesA, [blankNodeAString]: hash },
        { ...hashesB, [blankNodeBString]: hash },
      );
      if (result) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Count how often each value occurs in the given hash.
 * @param hash A hash.
 * @return {Map<number, number>} A map from value to number of occurrences.
 */
function countValues(hash: ITermHash): Map<number, number> {
  const counts: Map<number, number> = new Map();
  for (const key in hash) {
    counts.set(hash[key], (counts.get(hash[key]) ?? 0) + 1);
  }
  return counts;
}

/**
 * Check if the given bijection maps every quad of graph A onto a quad of graph B.
 * @param {IBijection} bijection A bijection from blank nodes of graph A to blank nodes of graph B.
 * @param {Quad[]} blankQuadsA Unique quads with blank nodes of graph A.
 * @param {Quad[]} blankQuadsB Unique quads with blank nodes of graph B.
 * @return {boolean} If the bijection maps graph A onto graph B.
 */
export function isBijectionValid<TQ extends RDF.BaseQuad = RDF.Quad>(
  bijection: IBijection,
  blankQuadsA: TQ[],
  blankQuadsB: TQ[],
): boolean {
  if (blankQuadsA.length !== blankQuadsB.length) {
    return false;
  }
  const quadsB: Set<string> = new Set(blankQuadsB.map(quad => quadToMappedString(quad)));
  return blankQuadsA.every(quad => quadsB.has(quadToMappedString(quad, bijection)));
}

/**
 * Convert the given quad to a string, replacing blank nodes using the given bijection.
 * @param {Quad} quad A quad.
 * @param {IBijection} bijection An optional bijection to rename blank nodes with.
 * @return {string} A string representation of the quad.
 */
function quadToMappedString(quad: RDF.BaseQuad, bijection?: IBijection): string {
  return JSON.stringify(getTerms(quad).map((term: RDF.Term) => {
    if (term.termType === 'Quad') {
      return quadToMappedString(term, bijection);
    }
    const termString: string = termToString(term);
    return term.termType === 'BlankNode' && bijection ? bijection[termString] : termString;
  }));
}

function arraysEqual(array1: any[], array2: any[]): boolean {
  if (array1.length !== array2.length) {
    return false;
  }
  for (let i = array1.length; i--;) {
    if (array1[i] !== array2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Get all values from the given hash
 * @param hash A hash.
 * @return {any[]} The array of values.
 */
export function hashValues(hash: IBijection): string[] {
  return Object.values(hash);
}

/**
 * Check if the given hash contains the given value.
 * @param hash A hash.
 * @param {string} value A value.
 * @return {boolean} If it contains the value.
 */
export function hasValue(hash: Record<string, number | string>, value: number | string): boolean {
  for (const hashValue in hash) {
    if (hash[hashValue] === value) {
      return true;
    }
  }
  return false;
}

/**
 * Get all quads with blank nodes.
 * @param {Quad[]} graph An array of quads.
 * @return {Quad[]} An array of quads with blank nodes
 */
export function getQuadsWithBlankNodes<TQ extends RDF.BaseQuad = RDF.Quad>(graph: TQ[]): TQ[] {
  return graph.filter((quad: TQ) => someTerms(quad, (value: RDF.Term) => value.termType === 'BlankNode' ||
      (value.termType === 'Quad' && getTermsNested(value).some(term => term.termType === 'BlankNode'))));
}

/**
 * Get all quads without blank nodes.
 * @param {Quad[]} graph An array of quads.
 * @return {Quad[]} An array of quads without blank nodes
 */
export function getQuadsWithoutBlankNodes<TQ extends RDF.BaseQuad = RDF.Quad>(graph: TQ[]): TQ[] {
  return graph.filter((quad: TQ) => everyTerms(quad, (value: RDF.Term) => value.termType !== 'BlankNode' &&
      !(value.termType === 'Quad' && getTermsNested(value).some(term => term.termType === 'BlankNode'))));
}

/**
 * Create a hash-based index of the given graph.
 * @param {Quad[]} graph An array of quads, the order does not matter.
 * @return {{[p: string]: boolean}} A hash-based datastructure representing the graph.
 */
export function indexGraph<TQ extends RDF.BaseQuad = RDF.Quad>(graph: TQ[]): Record<string, boolean> {
  const index: Record<string, boolean> = {};
  for (const quad of graph) {
    index[JSON.stringify(quadToStringQuad(quad))] = true;
  }
  return index;
}

/**
 * Create a graph from the given hash-based index.
 * @param {{[p: string]: boolean}} indexedGraph A hash-based datastructure representing the graph.
 * @return {Quad[]} An array of quads, the order does not matter.
 */
export function deindexGraph<TQ extends RDF.BaseQuad = RDF.Quad>(indexedGraph: Record<string, boolean>): TQ[] {
  return Object.keys(indexedGraph).map(str => stringQuadToQuad(<IStringQuad>JSON.parse(str)));
}

/**
 * Unique-ify the given RDF graph based on strict equality.
 * The output graph will consist of new quad and term instances.
 * @param {Quad[]} graph An input graph.
 * @return {Quad[]} The input graph without duplicates.
 */
export function uniqGraph<TQ extends RDF.BaseQuad = RDF.Quad>(graph: TQ[]): TQ[] {
  return deindexGraph(indexGraph(graph));
}

/**
 * Find all blank nodes in the given graph.
 * @param {Quad[]} graph An array of quads.
 * @return {BlankNode[]} A list of (unique) blank nodes.
 */
export function getGraphBlankNodes<TQ extends RDF.BaseQuad = RDF.Quad>(graph: TQ[]): RDF.BlankNode[] {
  return uniqTerms(graph.map((quad: TQ) => getBlankNodes(getTermsNested(quad)))
    .reduce((acc: RDF.BlankNode[], val: RDF.BlankNode[]) => [ ...acc, ...val ], []));
}

/**
 * Create term hashes for the given set of quads and blank node terms.
 *
 * @param {Quad[]} quads A set of quads.
 * @param {Term[]} terms Blank node terms.
 * @param {ITermHash} groundedHashes Grounded term hashes that are used to create more specific signatures
 *                                   of other terms, because they are based on non-blank nodes and grounded blank nodes.
 * @return {[ITermHash]} A tuple of grounded and ungrounded hashes.
 */
export function hashTerms<TQ extends RDF.BaseQuad = RDF.Quad>(
  quads: TQ[],
  terms: RDF.Term[],
  groundedHashes: ITermHash,
): [ITermHash, ITermHash] {
  const hashes: ITermHash = { ...groundedHashes };
  const ungroundedHashes: ITermHash = {};
  let hashNeeded = true;

  // Iteratively mark nodes as grounded.
  // If a node is marked as grounded, then the next iteration can lead to new grounded states
  while (hashNeeded) {
    const initialGroundedNodesCount: number = Object.keys(hashes).length;
    for (const term of terms) {
      const termString: string = termToString(term);
      if (!hashes[termString]) {
        const [ grounded, hash ] = hashTerm(term, quads, hashes);
        if (grounded) {
          hashes[termString] = hash;
        }
        ungroundedHashes[termString] = hash;
      }
    }

    // All terms that have a unique hash at this point can be marked as grounded
    const uniques: Map<number, string | boolean> = new Map();
    for (const termKey in ungroundedHashes) {
      const hash = ungroundedHashes[termKey];
      if (uniques.get(hash) === undefined) {
        uniques.set(hash, termKey);
      } else {
        uniques.set(hash, false);
      }
    }
    for (const [ hash, value ] of uniques.entries()) {
      if (value) {
        hashes[<string> value] = hash;
      }
    }

    // Check if the loop needs to terminate
    hashNeeded = initialGroundedNodesCount !== Object.keys(hashes).length;
  }

  return [ hashes, ungroundedHashes ];
}

/**
 * Generate a hash for the given term based on the signature of the quads it appears in.
 *
 * Signatures are made up of grounded terms in quads that are associated with a term,
 * i.e., everything except for ungrounded blank nodes.
 * The hash is created by hashing a sorted list of each quad's signature,
 * where each quad signature is a concatenation of the signature of all grounded terms.
 *
 * Terms are considered grounded if they are a member in the given hash AND if they are not the given term.
 *
 * @param {Term} term The term to get the hash around.
 * @param {Quad[]} quads The quads to include in the hashing.
 * @param {ITermHash} hashes A grounded term hash object.
 * @return {[boolean , number]} A tuple indicating if the given term is grounded in all the given quads, and the hash.
 */
export function hashTerm<TQ extends RDF.BaseQuad = RDF.Quad>(term: RDF.Term, quads: TQ[], hashes: ITermHash):
[boolean, number] {
  const quadSignatures = [];
  let grounded = true;
  for (const quad of quads) {
    const terms = getTermsNested(quad);
    if (terms.some((quadTerm: RDF.Term) => quadTerm.equals(term))) {
      quadSignatures.push(quadToSignature(quad, hashes, term));
      for (const quadTerm of terms) {
        if (!isTermGrounded(quadTerm, hashes) && !quadTerm.equals(term)) {
          grounded = false;
        }
      }
    }
  }
  const hash: number = hashNumber(quadSignatures.sort().join(''));
  return [ grounded, hash ];
}

/**
 * Create a number hash.
 * @param {string} data Something to hash.
 * @return {string} A hash string.
 */
export function hashNumber(data: string): number {
  return murmurHash3().hash(data).result();
}

/**
 * Convert the given quad to a string signature so that it can be used in the hash structure.
 * @param {Quad} quad A quad.
 * @param {ITermHash} hashes A grounded term hash object.
 * @param {Term} term A target term to compare with.
 * @return {string} A string signature.
 */
export function quadToSignature<TQ extends RDF.BaseQuad = RDF.Quad>(
  quad: TQ,
  hashes: ITermHash,
  term: RDF.Term,
): string {
  return getTerms(quad).map((quadTerm: RDF.Term) => termToSignature(quadTerm, hashes, term)).join('|');
}

/**
 * Convert the given term to a string signature so that it can be used in the hash structure.
 * @param {Term} term A term.
 * @param {ITermHash} hashes A grounded term hash object.
 * @param {Term} target A target term to compare with.
 * @return {string} A string signature.
 */
export function termToSignature(term: RDF.Term, hashes: ITermHash, target: RDF.Term): string {
  if (term.equals(target)) {
    return '@self';
  }
  if (term.termType === 'BlankNode') {
    return hashes[termToString(term)]?.toString() || '@blank';
  }
  if (term.termType === 'Quad') {
    return `<${quadToSignature(term, hashes, target)}>`;
  }
  return termToString(term);
}

/**
 * Check if a term is grounded.
 *
 * A term is grounded if it is not a blank node
 * or if it included in the given hash of grounded nodes.
 *
 * @param {Term} term A term.
 * @param {ITermHash} hashes A grounded term hash object.
 * @return {boolean} If the given term is grounded.
 */
export function isTermGrounded(term: RDF.Term, hashes: ITermHash): boolean {
  return (
    term.termType !== 'BlankNode' &&
    !(term.termType === 'Quad' && getTermsNested(term).some(subTerm => !isTermGrounded(subTerm, hashes)))
  ) || Boolean(hashes[termToString(term)]);
}

export type ITermHash = Record<string, number>;

export type IBijection = Record<string, string>;
