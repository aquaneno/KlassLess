import React, { useState } from 'react';
import { Network } from 'lucide-react';

interface NameLink {
  source: string;
  target: string;
}

interface Person {
  name: string;
  gender: string;
}

interface Node {
  id: string;
  gender: string;
  group: number;
}

function App() {
  const [names, setNames] = useState<string>('');
  const [links, setLinks] = useState<string>('');
  const [minGroupSize, setMinGroupSize] = useState<number>(3);
  const [maxGroupSize, setMaxGroupSize] = useState<number>(5);
  const [maxGroups, setMaxGroups] = useState<number>(3);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<NameLink[]>([]);
  const [error, setError] = useState<string>('');

  const findConnectedNames = (name: string, linkPairs: NameLink[]): Set<string> => {
    const connected = new Set<string>([name]);
    let size;
    do {
      size = connected.size;
      linkPairs.forEach(link => {
        if (connected.has(link.source)) connected.add(link.target);
        if (connected.has(link.target)) connected.add(link.source);
      });
    } while (size !== connected.size);
    return connected;
  };

  const countConnectionsBetweenGroups = (group1: string[], group2: string[], linkPairs: NameLink[]): number => {
    let connections = 0;
    for (const link of linkPairs) {
      if (
        (group1.includes(link.source) && group2.includes(link.target)) ||
        (group1.includes(link.target) && group2.includes(link.source))
      ) {
        connections++;
      }
    }
    return connections;
  };

  const mergeGroups = (groups: string[][], linkPairs: NameLink[], maxSize: number, targetGroupCount: number): string[][] => {
    if (groups.length <= targetGroupCount) return groups;

    while (groups.length > targetGroupCount) {
      let bestMergeScore = -1;
      let bestPair: [number, number] = [-1, -1];

      // Find the best pair of groups to merge
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const combinedSize = groups[i].length + groups[j].length;
          if (combinedSize <= maxSize) {
            const connectionCount = countConnectionsBetweenGroups(groups[i], groups[j], linkPairs);
            const score = connectionCount;
            if (score > bestMergeScore) {
              bestMergeScore = score;
              bestPair = [i, j];
            }
          }
        }
      }

      if (bestPair[0] === -1) {
        // No valid merge found
        break;
      }

      // Merge the groups
      const [i, j] = bestPair;
      const mergedGroup = [...groups[i], ...groups[j]];
      groups.splice(j, 1); // Remove second group first (higher index)
      groups.splice(i, 1); // Remove first group
      groups.push(mergedGroup); // Add merged group
    }

    return groups;
  };

  const createConnectedGroups = (uniqueNames: string[], peopleMap: Map<string, Person>, linkPairs: NameLink[], minSize: number, maxSize: number) => {
    const unassignedNames = new Set(uniqueNames);
    const groups: string[][] = [];
    let currentGroup: string[] = [];

    while (unassignedNames.size > 0) {
      if (currentGroup.length === 0) {
        // Start a new group with the first unassigned name
        const [firstUnassigned] = unassignedNames;
        currentGroup.push(firstUnassigned);
        unassignedNames.delete(firstUnassigned);
      }

      // Find all names connected to the current group
      const connectedToGroup = new Set<string>();
      currentGroup.forEach(name => {
        const connected = findConnectedNames(name, linkPairs);
        connected.forEach(c => {
          if (unassignedNames.has(c)) connectedToGroup.add(c);
        });
      });

      if (connectedToGroup.size === 0 || currentGroup.length >= maxSize) {
        // If group is smaller than minimum size and there are unassigned names,
        // try to add any unassigned name to reach minimum size
        while (currentGroup.length < minSize && unassignedNames.size > 0) {
          const [nextName] = unassignedNames;
          currentGroup.push(nextName);
          unassignedNames.delete(nextName);
        }
        
        // No more connected names or group is full, start a new group
        groups.push(currentGroup);
        currentGroup = [];
        continue;
      }

      // Add the first connected name to the current group
      const [nextName] = connectedToGroup;
      currentGroup.push(nextName);
      unassignedNames.delete(nextName);
    }

    // Add the last group if it's not empty
    if (currentGroup.length > 0) {
      // Try to reach minimum size if possible
      while (currentGroup.length < minSize && unassignedNames.size > 0) {
        const [nextName] = unassignedNames;
        currentGroup.push(nextName);
        unassignedNames.delete(nextName);
      }
      groups.push(currentGroup);
    }

    return groups;
  };

  const processInput = () => {
    try {
      // Process names with gender
      const peopleMap = new Map<string, Person>();
      const nameList = names.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [name, gender = ''] = line.split(',').map(part => part.trim());
          if (!name) throw new Error('Invalid name format');
          if (!['M', 'F', 'm', 'f'].includes(gender)) {
            throw new Error(`Invalid gender for ${name}. Use M or F.`);
          }
          const person: Person = {
            name,
            gender: gender.toUpperCase()
          };
          peopleMap.set(name, person);
          return name;
        });

      const uniqueNames = [...new Set(nameList)];

      if (minGroupSize <= 0) {
        throw new Error('Minimum group size must be greater than 0');
      }

      if (maxGroupSize < minGroupSize) {
        throw new Error('Maximum group size must be greater than or equal to minimum group size');
      }

      if (maxGroups <= 0) {
        throw new Error('Maximum number of groups must be greater than 0');
      }
      
      // Process links
      const linkPairs = links.split('\n')
        .filter(link => link.trim())
        .map(link => {
          const [source, target] = link.split(',').map(n => n.trim());
          if (!source || !target) throw new Error('Invalid link format');
          if (!uniqueNames.includes(source) || !uniqueNames.includes(target)) {
            throw new Error(`Link contains name not in names list: ${source} or ${target}`);
          }
          return { source, target };
        });

      // Create initial connected groups
      let groups = createConnectedGroups(uniqueNames, peopleMap, linkPairs, minGroupSize, maxGroupSize);
      
      // Merge groups if necessary
      groups = mergeGroups(groups, linkPairs, maxGroupSize, maxGroups);
      
      // Create nodes with assigned groups
      const nodes = groups.flatMap((group, groupIndex) =>
        group.map(name => ({
          id: name,
          gender: peopleMap.get(name)!.gender,
          group: groupIndex
        }))
      );

      setNodes(nodes);
      setConnections(linkPairs);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid input');
    }
  };

  const groupedNodes = nodes.reduce<Record<number, Node[]>>((acc, node) => {
    if (!acc[node.group]) {
      acc[node.group] = [];
    }
    acc[node.group].push(node);
    return acc;
  }, {});

  const getConnectionsInGroup = (groupId: number) => {
    const groupNodeIds = new Set(groupedNodes[groupId]?.map(n => n.id) || []);
    return connections.filter(
      conn => groupNodeIds.has(conn.source) && groupNodeIds.has(conn.target)
    );
  };

  const getConnectionsForName = (name: string, groupConnections: NameLink[]) => {
    return groupConnections.filter(
      conn => conn.source === name || conn.target === name
    ).length;
  };

  const getGenderCounts = (nodes: Node[]) => {
    return nodes.reduce(
      (acc, node) => {
        acc[node.gender]++;
        return acc;
      },
      { M: 0, F: 0 }
    );
  };

  const getIsolatedMembers = (groupId: number) => {
    const groupNodes = groupedNodes[groupId] || [];
    const groupConnections = getConnectionsInGroup(groupId);
    return groupNodes.filter(node => getConnectionsForName(node.id, groupConnections) === 0);
  };

  const hasIsolatedMembers = () => {
    return Object.keys(groupedNodes).some(groupId => 
      getIsolatedMembers(parseInt(groupId)).length > 0
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Network className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Name Cluster Visualization</h1>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Names (one per line, format: name,gender - use M or F)
            </label>
            <textarea
              className="w-full h-48 p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={names}
              onChange={(e) => setNames(e.target.value)}
              placeholder="John,M&#10;Jane,F&#10;Bob,M"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Links (source,target per line)
            </label>
            <textarea
              className="w-full h-48 p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder="John,Jane&#10;Jane,Bob"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Group Size
            </label>
            <input
              type="number"
              min="1"
              value={minGroupSize}
              onChange={(e) => {
                const value = Math.max(1, parseInt(e.target.value) || 1);
                setMinGroupSize(value);
                if (value > maxGroupSize) {
                  setMaxGroupSize(value);
                }
              }}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Group Size
            </label>
            <input
              type="number"
              min={minGroupSize}
              value={maxGroupSize}
              onChange={(e) => setMaxGroupSize(Math.max(minGroupSize, parseInt(e.target.value) || minGroupSize))}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Number of Groups
            </label>
            <input
              type="number"
              min="1"
              value={maxGroups}
              onChange={(e) => setMaxGroups(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <button
          onClick={processInput}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Generate Cluster
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
            {error}
          </div>
        )}

        {nodes.length > 0 && (
          <div className="mt-6 bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Cluster Results</h2>
            
            {/* Summary Table */}
            <div className="mb-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Group
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Members
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Connections
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Males
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Females
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg. Connections
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(groupedNodes).map(([groupId, groupNodes]) => {
                    const groupConnections = getConnectionsInGroup(parseInt(groupId));
                    const genderCounts = getGenderCounts(groupNodes);
                    const avgConnections = (groupConnections.length / groupNodes.length).toFixed(1);
                    
                    return (
                      <tr key={groupId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          Group {parseInt(groupId) + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {groupNodes.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {groupConnections.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {genderCounts.M}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {genderCounts.F}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {avgConnections}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Isolated Members */}
            {hasIsolatedMembers() && (
              <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">Members without connections in their groups:</h3>
                <div className="space-y-2">
                  {Object.entries(groupedNodes).map(([groupId, _]) => {
                    const isolatedMembers = getIsolatedMembers(parseInt(groupId));
                    if (isolatedMembers.length === 0) return null;
                    
                    return (
                      <div key={groupId} className="text-sm text-yellow-700">
                        <span className="font-medium">Group {parseInt(groupId) + 1}:</span>{' '}
                        {isolatedMembers.map(node => (
                          <span key={node.id} className="inline-flex items-center gap-1 mr-2">
                            {node.id}
                            <span className={`text-xs px-1 rounded ${
                              node.gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                            }`}>
                              {node.gender}
                            </span>
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detailed Groups */}
            <div className="space-y-6">
              {Object.entries(groupedNodes).map(([groupId, groupNodes]) => {
                const groupConnections = getConnectionsInGroup(parseInt(groupId));
                const genderCounts = getGenderCounts(groupNodes);
                return (
                  <div key={groupId} className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-700 mb-3">
                      Group {parseInt(groupId) + 1} ({groupNodes.length} members, {groupConnections.length} connections, {genderCounts.M} males, {genderCounts.F} females)
                    </h3>
                    <ul className="grid grid-cols-3 gap-2 mb-3">
                      {groupNodes.map((node) => (
                        <li key={node.id} className="bg-white p-2 rounded shadow-sm flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span>{node.id}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              node.gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                            }`}>
                              {node.gender}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            ({getConnectionsForName(node.id, groupConnections)} connections)
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="text-sm text-gray-600">
                      <h4 className="font-medium">Group Connections:</h4>
                      <ul className="mt-1 space-y-1">
                        {groupConnections.map((link, i) => (
                          <li key={i}>
                            {link.source} → {link.target}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;