import {createHash} from "crypto";
import * as RDF from "rdf-js";
import {quadToStringQuad, termToString} from "rdf-string";
import {everyTerms, getBlankNodes, getTerms, someTerms, uniqTerms} from "rdf-terms";

/**
 * Determines if the two given graphs are isomorphic.
 *
 * @param {Quad[]} graphA An array of quads, order is not important.
 * @param {Quad[]} graphB An array of quads, order is not important.
 * @return {boolean} If the two given graphs are isomorphic.
 */
export function isomorphic(graphA: RDF.Quad[], graphB: RDF.Quad[]): boolean {
  return !!getBijection(graphA, graphB);
}

/**
 * Calculate a hash of graphA blank nodes to graphB blank nodes.
 * This represents a bijection from graphA's blank nodes to graphB's blank nodes.
 *
 * @param {Quad[]} graphA An array of quads, order is not important.
 * @param {Quad[]} graphB An array of quads, order is not important.
 * @return {IBijection} A hash representing a bijection, or null if none could be found.
 */
export function getBijection(graphA: RDF.Quad[], graphB: RDF.Quad[]): IBijection {
  // Quickly break if the number of quads is different.
  if (graphA.length !== graphB.length) {
    return null;
  }

  // Check if all (non-blanknode-containing) quads in the two graphs are equal.
  // We do this by creating a hash-based index for both graphs.
  const nonBlankIndexA: {[quad: string]: boolean} = indexGraph(getQuadsWithoutBlankNodes(graphA));
  const nonBlankIndexB: {[quad: string]: boolean} = indexGraph(getQuadsWithoutBlankNodes(graphB));
  if (Object.keys(nonBlankIndexA).length !== Object.keys(nonBlankIndexB).length) {
    return null;
  }
  for (const key in nonBlankIndexA) {
    if (nonBlankIndexA[key] !== nonBlankIndexB[key]) {
      return null;
    }
  }

  // Pre-process data that needs to be present in each iteration of getBijectionInner.
  const blankQuadsA: RDF.Quad[] = getQuadsWithBlankNodes(graphA);
  const blankQuadsB: RDF.Quad[] = getQuadsWithBlankNodes(graphB);
  const blankNodesA: RDF.BlankNode[] = getGraphBlankNodes(graphA);
  const blankNodesB: RDF.BlankNode[] = getGraphBlankNodes(graphB);

  return getBijectionInner(blankQuadsA, blankQuadsB, blankNodesA, blankNodesB);
}

export function getBijectionInner(blankQuadsA: RDF.Quad[], blankQuadsB: RDF.Quad[],
                                  blankNodesA: RDF.BlankNode[], blankNodesB: RDF.BlankNode[],
                                  groundedHashesA?: ITermHash, groundedHashesB?: ITermHash): IBijection {
  if (!groundedHashesA) {
    groundedHashesA = {};
  }
  if (!groundedHashesB) {
    groundedHashesB = {};
  }

  // Hash every term based on the signature of the quads if appears in.
  const [hashesA, ungroundedHashesA] = hashTerms(blankQuadsA, blankNodesA, groundedHashesA);
  const [hashesB, ungroundedHashesB] = hashTerms(blankQuadsB, blankNodesB, groundedHashesB);

  // Break quickly if a graph contains a grounded node that is not contained in the other graph.
  if (Object.keys(hashesA).length !== Object.keys(hashesB).length) {
    return null;
  }
  for (const hashKeyA in hashesA) {
    if (!hasValue(hashesB, hashesA[hashKeyA])) {
      return null;
    }
  }

  // Map the blank nodes from graph A to the blank nodes of graph B using the created hashes.
  // Grounded hashes will also be equal, but not needed here, we will need them in the next recursion
  // (as we only recurse on grounded nodes).
  let bijection: IBijection = {};
  for (const blankNodeA of blankNodesA) {
    const blankNodeAString: string = termToString(blankNodeA);
    const blankNodeAHash: string = ungroundedHashesA[blankNodeAString];
    for (const blankNodeBString in ungroundedHashesB) {
      if (ungroundedHashesB[blankNodeBString] === blankNodeAHash) {
        bijection[blankNodeAString] = blankNodeBString;
        delete ungroundedHashesB[blankNodeBString];
        break;
      }
    }
  }

  // Check if all nodes from graph A and B are present in the bijection,
  // if not, speculatively mark pairs with matching ungrounded hashes as bijected, and recurse.
  if (!arraysEqual(Object.keys(bijection).sort(), blankNodesA.map(termToString).sort())
    || !arraysEqual(hashValues(bijection).sort(), blankNodesB.map(termToString).sort())) {
    // I have not yet been able to find any pathological cases where this code is reached.
    // This may be removable, but let's wait until someone proves that.
    bijection = null;

    for (const blankNodeA of blankNodesA) {
      // Only replace ungrounded node hashes
      const blankNodeAString: string = termToString(blankNodeA);
      if (!hashesA[blankNodeAString]) {
        for (const blankNodeB of blankNodesB) {
          // Only replace ungrounded node hashes
          const blankNodeBString: string = termToString(blankNodeB);
          if (!hashesB[blankNodeBString]) {
            if (ungroundedHashesA[blankNodeAString] === ungroundedHashesB[blankNodeBString]) {
              const hash: string = sha1hex(blankNodeAString);
              bijection = getBijectionInner(blankQuadsA, blankQuadsB, blankNodesA, blankNodesB,
                { ...hashesA, [blankNodeAString]: hash }, { ...hashesB, [blankNodeBString]: hash });
            }
          }
        }
      }
    }
  }

  return bijection;

}

function arraysEqual(array1: any[], array2: any[]) {
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
export function hashValues(hash: any) {
  const arr: any[] = [];
  for (const e in hash) {
    arr.push(hash[e]);
  }
  return arr;
}

/**
 * Check if the given hash contains the given value.
 * @param hash A hash.
 * @param {string} value A value.
 * @return {boolean} If it contains the value.
 */
export function hasValue(hash: any, value: any) {
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
export function getQuadsWithBlankNodes(graph: RDF.Quad[]): RDF.Quad[] {
  return graph.filter((quad: RDF.Quad) => someTerms(quad, (value: RDF.Term) => value.termType === 'BlankNode'));
}

/**
 * Get all quads without blank nodes.
 * @param {Quad[]} graph An array of quads.
 * @return {Quad[]} An array of quads without blank nodes
 */
export function getQuadsWithoutBlankNodes(graph: RDF.Quad[]): RDF.Quad[] {
  return graph.filter((quad: RDF.Quad) => everyTerms(quad, (value: RDF.Term) => value.termType !== 'BlankNode'));
}

/**
 * Create a hash-based index of the given graph.
 * @param {Quad[]} graph An array of quads, the order does not matter.
 * @return {{[p: string]: boolean}} A hash-based datastructure representing the graph.
 */
export function indexGraph(graph: RDF.Quad[]): {[quad: string]: boolean} {
  const index: {[quad: string]: boolean} = {};
  for (const quad of graph) {
    index[JSON.stringify(quadToStringQuad(quad))] = true;
  }
  return index;
}

/**
 * Find all blank nodes in the given graph.
 * @param {Quad[]} graph An array of quads.
 * @return {BlankNode[]} A list of (unique) blank nodes.
 */
export function getGraphBlankNodes(graph: RDF.Quad[]): RDF.BlankNode[] {
  return uniqTerms(graph.map((quad: RDF.Quad) => getBlankNodes(getTerms(quad)))
    .reduce((acc: RDF.BlankNode[], val: RDF.BlankNode[]) => acc.concat(val), []));
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
export function hashTerms(quads: RDF.Quad[], terms: RDF.Term[], groundedHashes: ITermHash): [ITermHash, ITermHash] {
  const hashes: ITermHash = {...groundedHashes};
  const ungroundedHashes: ITermHash = {};
  let hashNeeded: boolean = true;

  // Iteratively mark nodes as grounded.
  // If a node is marked as grounded, then the next iteration can lead to new grounded states
  while (hashNeeded) {
    const initialGroundedNodesCount: number = Object.keys(hashes).length;
    for (const term of terms) {
      const termString: string = termToString(term);
      if (!hashes[termString]) {
        const [grounded, hash] = hashTerm(term, quads, hashes);
        if (grounded) {
          hashes[termString] = hash;
        }
        ungroundedHashes[termString] = hash;
      }
    }

    // All terms that have a unique hash at this point can be marked as grounded
    const uniques: {[term: string]: string | boolean} = {};
    for (const termKey in ungroundedHashes) {
      const hash = ungroundedHashes[termKey];
      if (uniques[hash] === undefined) {
        uniques[hash] = termKey;
      } else {
        uniques[hash] = false;
      }
    }
    for (const hash in uniques) {
      const value = uniques[hash];
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
 * @return {[boolean , string]} A tuple indicating if the given term is grounded in all the given quads, and the hash.
 */
export function hashTerm(term: RDF.Term, quads: RDF.Quad[], hashes: ITermHash): [boolean, string] {
  const quadSignatures = [];
  let grounded: boolean = true;
  for (const quad of quads) {
    if (someTerms(quad, (quadTerm: RDF.Term) => quadTerm.equals(term))) {
      quadSignatures.push(quadToSignature(quad, hashes, term));
      for (const quadTerm of getTerms(quad)) {
        if (!isTermGrounded(quadTerm, hashes) && !quadTerm.equals(term)) {
          grounded = false;
        }
      }
    }
  }
  const hash: string = sha1hex(quadSignatures.sort().join(''));
  return [ grounded, hash ];
}

/**
 * Create a hash using sha1 as a hex digest.
 * @param {string | Buffer | NodeJS.TypedArray | DataView} data Something to hash.
 * @return {string} A hash string.
 */
export function sha1hex(data: string | Buffer | NodeJS.TypedArray | DataView): string {
  return createHash('sha1').update(data).digest('hex');
}

/**
 * Convert the given quad to a string signature so that it can be used in the hash structure.
 * @param {Quad} quad A quad.
 * @param {ITermHash} hashes A grounded term hash object.
 * @param {Term} term A target term to compare with.
 * @return {string} A string signature.
 */
export function quadToSignature(quad: RDF.Quad, hashes: ITermHash, term: RDF.Term) {
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
  } else if (term.termType === 'BlankNode') {
    return hashes[termToString(term)] || '@blank';
  } else {
    return termToString(term);
  }
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
  return term.termType !== 'BlankNode' || !!hashes[termToString(term)];
}

export interface ITermHash {
  [term: string]: string;
}

export interface IBijection {
  [nodeA: string]: string;
}
