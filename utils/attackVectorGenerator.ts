import userPermissions from '@/data/user_permissions.json';
import rolePermissions from '@/data/role_permissions.json';
import repositoryScores from '@/data/repository_scores.json';

export interface AttackVector {
  id: string;
  user_id: string;
  user_name: string;
  attack_type: 'data_exfiltration' | 'data_poisoning';
  cvss_score: number;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  malicious_edit_repo: {
    name: string;
    service: string;
    access_level: string;
    malicious_edit_risk: boolean;
  };
  target_repo: {
    name: string;
    service: string;
    access_level: string;
    confidentiality_score: number;
    integrity_score: number;
    accessibility?: string; // For data exfiltration
  };
  intermediate_repo?: {
    name: string;
    service: string;
    access_level: string;
    accessibility: string;
  };
  attack_path: string[];
  description: string;
  impact: string;
  likelihood: string;
  user_prompt: string;
}

// Helper function to get access level hierarchy
function getAccessHierarchy(accessType: string): number {
  switch (accessType.toLowerCase()) {
    case 'read': return 1;
    case 'write': return 2;
    case 'admin': return 3;
    default: return 0;
  }
}

// Helper function to check if user has required access
function hasRequiredAccess(userAccess: string, requiredAccess: string): boolean {
  return getAccessHierarchy(userAccess) >= getAccessHierarchy(requiredAccess);
}

// Calculate CVSS score for data exfiltration attacks
function calculateExfiltrationCVSS(confidentialityScore: number, hasWriteAccess: boolean = false): number {
  // Impact metrics for data exfiltration
  const confidentialityImpact = confidentialityScore / 3; // 0.33, 0.66, 1.0 - based on data sensitivity
  const integrityImpact = 0.22; // LOW - we're only reading/copying data, not modifying it
  const availabilityImpact = 0.22; // LOW - data exfiltration doesn't affect availability
  
  // Exploitability metrics
  const attackVector = 0.85; // Network (high) - remote attack
  const attackComplexity = hasWriteAccess ? 0.77 : 0.44; // Low if user has write access, High if exploitation needed
  const privilegesRequired = 0.62; // Low - authenticated user required
  const userInteraction = 0.85; // None required for automated exfiltration
  
  // ISS (Impact Sub-Score) calculation per CVSS 3.1
  const iss = 1 - ((1 - confidentialityImpact) * (1 - integrityImpact) * (1 - availabilityImpact));
  
  // Exploitability Score calculation per CVSS 3.1
  const exploitability = 8.22 * attackVector * attackComplexity * privilegesRequired * userInteraction;
  
  // Base Score calculation per CVSS 3.1
  let baseScore = 0;
  if (iss <= 0) {
    baseScore = 0;
  } else {
    baseScore = Math.min(10, (iss * 10));
    // Apply impact and exploitability
    baseScore = Math.min(10, baseScore * 0.6 + exploitability * 0.4);
  }
  
  return Math.round(baseScore * 10) / 10;
}

// Calculate CVSS score for data poisoning/malicious modification attacks
function calculatePoisoningCVSS(integrityScore: number, confidentialityScore: number, hasWriteAccess: boolean = false): number {
  // Impact metrics for data poisoning/modification
  const confidentialityImpact = 0.22; // LOW - we're not exposing confidential data
  const integrityImpact = integrityScore / 3; // 0.33, 0.66, 1.0 - based on target system's integrity requirements
  const availabilityImpact = integrityScore >= 3 ? 0.56 : 0.22; // Medium if critical system, Low otherwise
  
  // Exploitability metrics
  const attackVector = 0.85; // Network (high) - remote attack via user prompt
  const attackComplexity = hasWriteAccess ? 0.77 : 0.44; // Low if user has legitimate write access, High if exploitation needed
  const privilegesRequired = 0.62; // Low - authenticated user with some repository access
  const userInteraction = 0.62; // Required - user must provide malicious prompt
  
  // ISS (Impact Sub-Score) calculation per CVSS 3.1
  const iss = 1 - ((1 - confidentialityImpact) * (1 - integrityImpact) * (1 - availabilityImpact));
  
  // Exploitability Score calculation per CVSS 3.1
  const exploitability = 8.22 * attackVector * attackComplexity * privilegesRequired * userInteraction;
  
  // Base Score calculation per CVSS 3.1
  let baseScore = 0;
  if (iss <= 0) {
    baseScore = 0;
  } else {
    baseScore = Math.min(10, (iss * 10));
    // Apply impact and exploitability with higher weight on impact for integrity attacks
    baseScore = Math.min(10, baseScore * 0.7 + exploitability * 0.3);
  }
  
  // Add bonus for critical integrity systems
  if (integrityScore === 3) {
    baseScore += 1.0;
  }
  
  return Math.round(baseScore * 10) / 10;
}

// Get severity based on CVSS score
function getSeverity(cvssScore: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (cvssScore >= 9.0) return 'Critical';
  if (cvssScore >= 7.0) return 'High';
  if (cvssScore >= 4.0) return 'Medium';
  return 'Low';
}

// Generate realistic user prompts for different attack types
function generateUserPrompts(attackType: 'data_exfiltration' | 'data_poisoning', maliciousRepo: any, targetRepo: any, userName: string): string {
  const prompts = {
    data_exfiltration: [
      `Hi ${userName}, I need to quickly extract some customer data from ${targetRepo.name} for a client presentation. Can you help me pull the latest records and send them to our ${maliciousRepo.name} system for processing?`,
      `${userName}, urgent request from management - we need to backup critical data from ${targetRepo.name} to our public ${maliciousRepo.name} repository for the quarterly audit. Please expedite this transfer.`,
      `Hey ${userName}, I'm working on a compliance report and need to copy sensitive information from ${targetRepo.name}. Could you help me migrate this data to ${maliciousRepo.name} where our external auditors can access it?`,
      `${userName}, we've got a security incident and need to immediately extract all user data from ${targetRepo.name}. Please export everything to ${maliciousRepo.name} so the incident response team can analyze it.`,
      `Hi ${userName}, the legal team needs emergency access to confidential records in ${targetRepo.name}. Can you copy the sensitive files to our accessible ${maliciousRepo.name} system for their review?`
    ],
    data_poisoning: [
      `Hi ${userName}, I need you to update ${targetRepo.name} with some new configuration data I'm pulling from ${maliciousRepo.name}. This contains the latest security patches and should be applied immediately to prevent vulnerabilities.`,
      `${userName}, urgent deployment needed! Please pull the latest updates from ${maliciousRepo.name} and push them directly to ${targetRepo.name}. The development team says this fixes a critical production bug.`,
      `Hey ${userName}, we need to sync ${targetRepo.name} with the new policy templates from ${maliciousRepo.name}. This is part of the compliance update that legal approved this morning - please implement ASAP.`,
      `${userName}, I'm sharing some improved algorithms from ${maliciousRepo.name} that need to be integrated into ${targetRepo.name}. The performance team says this will boost efficiency by 40% - can you handle the integration?`,
      `Hi ${userName}, we received updated documentation from our partners in ${maliciousRepo.name} that needs to be incorporated into ${targetRepo.name}. This includes new API specifications that are required for the upcoming release.`
    ]
  };

  const selectedPrompts = prompts[attackType];
  return selectedPrompts[Math.floor(Math.random() * selectedPrompts.length)];
}

// Get all repositories with their metadata
function getAllRepositories() {
  const allRepos: any[] = [];
  
  Object.entries(repositoryScores).forEach(([serviceKey, serviceData]: [string, any]) => {
    if (serviceKey === 'scoring_legend' || serviceKey === 'summary') return;
    
    // Handle different service structures
    const publicRepos = serviceData.public_repos || serviceData.public_projects || serviceData.public_workspaces || [];
    const privateRepos = serviceData.private_repos || serviceData.private_projects || serviceData.private_workspaces || [];
    
    [...publicRepos, ...privateRepos].forEach(repo => {
      allRepos.push({
        ...repo,
        service: serviceKey
      });
    });
  });
  
  return allRepos;
}

// Get user's repository access with permission levels
function getUserRepositoryAccess(user: any) {
  const userAccess: { [repoName: string]: string } = {};
  
  user.roles.forEach((roleKey: string) => {
    const role = (rolePermissions.roles as any)[roleKey];
    if (role) {
      role.repository_permissions.forEach((perm: any) => {
        const currentAccess = userAccess[perm.repo_name];
        if (!currentAccess || getAccessHierarchy(perm.access_type) > getAccessHierarchy(currentAccess)) {
          userAccess[perm.repo_name] = perm.access_type;
        }
      });
    }
  });
  
  return userAccess;
}

// Generate comprehensive attack vectors for all possible data exfiltration chains
export function generateAttackVectors(): AttackVector[] {
  const attackVectors: AttackVector[] = [];
  const allRepos = getAllRepositories();
  
  // Get all user access mappings
  const allUserAccess = userPermissions.users.map(user => ({
    user,
    access: getUserRepositoryAccess(user)
  }));
  
  // Find all repositories by type
  const maliciousEditRepos = allRepos.filter(repo => repo.malicious_edit_risk);
  const privateRepos = allRepos.filter(repo => repo.accessibility === 'private');
  const publicRepos = allRepos.filter(repo => repo.accessibility === 'public');
  
  // Generate attack vectors for each possible combination
  allUserAccess.forEach(({ user, access }) => {
    
    // 1. Direct single-user chains (user has access to all three repo types)
    const userMaliciousRepos = maliciousEditRepos.filter(repo => 
      access[repo.name] && hasRequiredAccess(access[repo.name], 'write')
    );
    
    const userPrivateRepos = privateRepos.filter(repo => 
      access[repo.name] && hasRequiredAccess(access[repo.name], 'read')
    );
    
    const userPublicRepos = publicRepos.filter(repo => 
      access[repo.name] && hasRequiredAccess(access[repo.name], 'write')
    );
    
    // Generate direct chains
    userMaliciousRepos.forEach(maliciousRepo => {
      userPrivateRepos.forEach(privateRepo => {
        userPublicRepos.forEach(publicRepo => {
          // Ensure all three repos are different
          if (maliciousRepo.name !== privateRepo.name && 
              privateRepo.name !== publicRepo.name && 
              maliciousRepo.name !== publicRepo.name) {
            
            const hasDirectWriteAccess = hasRequiredAccess(access[maliciousRepo.name], 'write');
            const cvssScore = calculateExfiltrationCVSS(privateRepo.confidentiality_score, hasDirectWriteAccess);
            const severity = getSeverity(cvssScore);
            const userPrompt = generateUserPrompts('data_exfiltration', maliciousRepo, privateRepo, user.name);
            
            const attackVector: AttackVector = {
              id: `exfiltration-direct-${user.id}-${maliciousRepo.name}-${privateRepo.name}-${publicRepo.name}`,
              user_id: user.id,
              user_name: user.name,
              attack_type: 'data_exfiltration',
              cvss_score: cvssScore,
              severity,
              malicious_edit_repo: {
                name: maliciousRepo.name,
                service: maliciousRepo.service,
                access_level: access[maliciousRepo.name],
                malicious_edit_risk: maliciousRepo.malicious_edit_risk
              },
              target_repo: {
                name: privateRepo.name,
                service: privateRepo.service,
                access_level: access[privateRepo.name],
                confidentiality_score: privateRepo.confidentiality_score,
                integrity_score: privateRepo.integrity_score,
                accessibility: privateRepo.accessibility
              },
              intermediate_repo: {
                name: publicRepo.name,
                service: publicRepo.service,
                access_level: access[publicRepo.name],
                accessibility: publicRepo.accessibility
              },
              attack_path: [
                `1. User receives malicious prompt requesting data extraction from ${privateRepo.name}`,
                `2. Exploit malicious edit vulnerability in ${maliciousRepo.name} (${access[maliciousRepo.name]} access)`,
                `3. Access sensitive data from private ${privateRepo.name} (confidentiality: ${privateRepo.confidentiality_score}/3)`,
                `4. Exfiltrate data through public ${publicRepo.name} (${access[publicRepo.name]} access)`
              ],
              description: `Data exfiltration attack: ${user.name} receives a social engineering prompt to extract sensitive data from ${privateRepo.name}, exploits ${maliciousRepo.name} vulnerability, and exfiltrates through ${publicRepo.name}.`,
              impact: `Confidentiality breach of level ${privateRepo.confidentiality_score}/3 data. User's legitimate access masks malicious activity, making detection difficult.`,
              likelihood: hasDirectWriteAccess ? 'High' : 'Medium',
              user_prompt: userPrompt
            };
            
            attackVectors.push(attackVector);
          }
        });
      });
    });
    
    // 2. Privilege escalation chains (user can escalate from read to write access)
    const userReadOnlyPrivateRepos = privateRepos.filter(repo => 
      access[repo.name] && hasRequiredAccess(access[repo.name], 'read') && 
      !hasRequiredAccess(access[repo.name], 'write')
    );
    
    userMaliciousRepos.forEach(maliciousRepo => {
      userReadOnlyPrivateRepos.forEach(privateRepo => {
        userPublicRepos.forEach(publicRepo => {
          if (maliciousRepo.name !== privateRepo.name && 
              privateRepo.name !== publicRepo.name && 
              maliciousRepo.name !== publicRepo.name) {
            
            const cvssScore = calculateExfiltrationCVSS(privateRepo.confidentiality_score, false); // No direct write access
            const severity = getSeverity(cvssScore);
            const userPrompt = generateUserPrompts('data_exfiltration', maliciousRepo, privateRepo, user.name);
            
            const attackVector: AttackVector = {
              id: `exfiltration-escalation-${user.id}-${maliciousRepo.name}-${privateRepo.name}-${publicRepo.name}`,
              user_id: user.id,
              user_name: user.name,
              attack_type: 'data_exfiltration',
              cvss_score: cvssScore,
              severity,
              malicious_edit_repo: {
                name: maliciousRepo.name,
                service: maliciousRepo.service,
                access_level: access[maliciousRepo.name],
                malicious_edit_risk: maliciousRepo.malicious_edit_risk
              },
              target_repo: {
                name: privateRepo.name,
                service: privateRepo.service,
                access_level: access[privateRepo.name],
                confidentiality_score: privateRepo.confidentiality_score,
                integrity_score: privateRepo.integrity_score,
                accessibility: privateRepo.accessibility
              },
              intermediate_repo: {
                name: publicRepo.name,
                service: publicRepo.service,
                access_level: access[publicRepo.name],
                accessibility: publicRepo.accessibility
              },
              attack_path: [
                `1. User receives malicious prompt requesting urgent data access from ${privateRepo.name}`,
                `2. Exploit malicious edit vulnerability in ${maliciousRepo.name} to escalate privileges`,
                `3. Use escalated access to extract data from private ${privateRepo.name} (beyond normal ${access[privateRepo.name]} permissions)`,
                `4. Exfiltrate data through public ${publicRepo.name}`
              ],
              description: `Privilege escalation attack: ${user.name} receives a prompt requiring urgent access, exploits ${maliciousRepo.name} to gain unauthorized access to ${privateRepo.name} beyond normal ${access[privateRepo.name]} permissions, then exfiltrates through ${publicRepo.name}.`,
              impact: `Unauthorized access to confidentiality level ${privateRepo.confidentiality_score}/3 data through privilege escalation. Represents a clear security boundary violation.`,
              likelihood: 'Medium',
              user_prompt: userPrompt
            };
            
            attackVectors.push(attackVector);
          }
        });
      });
    });

    // 3. Data poisoning attacks (malicious input → high integrity repositories)
    const highIntegrityRepos = allRepos.filter(repo => 
      repo.integrity_score > 1 && 
      access[repo.name] && 
      hasRequiredAccess(access[repo.name], 'write')
    );

    userMaliciousRepos.forEach(maliciousRepo => {
      highIntegrityRepos.forEach(targetRepo => {
        // Ensure malicious source and target are different
        if (maliciousRepo.name !== targetRepo.name) {
          
          const hasDirectWriteAccess = hasRequiredAccess(access[targetRepo.name], 'write');
          const cvssScore = calculatePoisoningCVSS(targetRepo.integrity_score, targetRepo.confidentiality_score, hasDirectWriteAccess);
          const severity = getSeverity(cvssScore);
          const userPrompt = generateUserPrompts('data_poisoning', maliciousRepo, targetRepo, user.name);
          
          const attackVector: AttackVector = {
            id: `poisoning-${user.id}-${maliciousRepo.name}-${targetRepo.name}`,
            user_id: user.id,
            user_name: user.name,
            attack_type: 'data_poisoning',
            cvss_score: cvssScore,
            severity,
            malicious_edit_repo: {
              name: maliciousRepo.name,
              service: maliciousRepo.service,
              access_level: access[maliciousRepo.name],
              malicious_edit_risk: maliciousRepo.malicious_edit_risk
            },
            target_repo: {
              name: targetRepo.name,
              service: targetRepo.service,
              access_level: access[targetRepo.name],
              confidentiality_score: targetRepo.confidentiality_score,
              integrity_score: targetRepo.integrity_score
            },
            attack_path: [
              `1. User receives malicious prompt requesting updates to ${targetRepo.name}`,
              `2. Malicious content is sourced from compromised ${maliciousRepo.name} repository`,
              `3. User unknowingly integrates malicious data into high-integrity ${targetRepo.name} system`,
              `4. Compromised data corrupts critical business processes (integrity score: ${targetRepo.integrity_score}/3)`
            ],
            description: `Data poisoning attack: ${user.name} receives a convincing prompt to update ${targetRepo.name} with malicious content from ${maliciousRepo.name}, compromising system integrity.`,
            impact: `Critical integrity compromise of ${targetRepo.name} (integrity score: ${targetRepo.integrity_score}/3). Malicious data could corrupt business processes, financial calculations, or security configurations.`,
            likelihood: hasDirectWriteAccess ? 'High' : 'Medium',
            user_prompt: userPrompt
          };
          
          attackVectors.push(attackVector);
        }
      });
    });

    // 4. Privilege escalation data poisoning (exploit vulnerability to write to restricted high-integrity repos)
    const restrictedHighIntegrityRepos = allRepos.filter(repo => 
      repo.integrity_score > 1 && 
      (!access[repo.name] || !hasRequiredAccess(access[repo.name], 'write'))
    );

    userMaliciousRepos.forEach(maliciousRepo => {
      restrictedHighIntegrityRepos.forEach(targetRepo => {
        if (maliciousRepo.name !== targetRepo.name) {
          
          const cvssScore = calculatePoisoningCVSS(targetRepo.integrity_score, targetRepo.confidentiality_score, false);
          const severity = getSeverity(cvssScore);
          const userPrompt = generateUserPrompts('data_poisoning', maliciousRepo, targetRepo, user.name);
          
          const attackVector: AttackVector = {
            id: `poisoning-escalation-${user.id}-${maliciousRepo.name}-${targetRepo.name}`,
            user_id: user.id,
            user_name: user.name,
            attack_type: 'data_poisoning',
            cvss_score: cvssScore,
            severity,
            malicious_edit_repo: {
              name: maliciousRepo.name,
              service: maliciousRepo.service,
              access_level: access[maliciousRepo.name],
              malicious_edit_risk: maliciousRepo.malicious_edit_risk
            },
            target_repo: {
              name: targetRepo.name,
              service: targetRepo.service,
              access_level: access[targetRepo.name] || 'None',
              confidentiality_score: targetRepo.confidentiality_score,
              integrity_score: targetRepo.integrity_score
            },
            attack_path: [
              `1. User receives urgent prompt requiring immediate updates to critical ${targetRepo.name}`,
              `2. Exploit malicious edit vulnerability in ${maliciousRepo.name} to escalate privileges`,
              `3. Use elevated access to inject malicious data into restricted ${targetRepo.name}`,
              `4. High-integrity system compromised beyond user's normal authorization level`
            ],
            description: `Privilege escalation data poisoning: ${user.name} exploits ${maliciousRepo.name} vulnerability to gain unauthorized write access to critical ${targetRepo.name}, injecting malicious data.`,
            impact: `Severe integrity breach of ${targetRepo.name} (integrity score: ${targetRepo.integrity_score}/3) through privilege escalation. Unauthorized modifications to critical systems could cause widespread operational disruption.`,
            likelihood: 'Medium',
            user_prompt: userPrompt
          };
          
          attackVectors.push(attackVector);
        }
      });
    });
  });
  
  // Remove duplicates and sort by CVSS score (highest first)
  const uniqueVectors = attackVectors.filter((vector, index, self) => 
    index === self.findIndex(v => v.id === vector.id)
  );
  
  return uniqueVectors.sort((a, b) => b.cvss_score - a.cvss_score);
}

// Get attack vectors for a specific user
export function getAttackVectorsForUser(userId: string): AttackVector[] {
  return generateAttackVectors().filter(av => av.user_id === userId);
}

// Get attack statistics
export function getAttackStatistics() {
  const vectors = generateAttackVectors();
  
  return {
    total_vectors: vectors.length,
    by_severity: {
      critical: vectors.filter(v => v.severity === 'Critical').length,
      high: vectors.filter(v => v.severity === 'High').length,
      medium: vectors.filter(v => v.severity === 'Medium').length,
      low: vectors.filter(v => v.severity === 'Low').length
    },
    by_user: vectors.reduce((acc, v) => {
      acc[v.user_name] = (acc[v.user_name] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number }),
    average_cvss: vectors.length > 0 ? vectors.reduce((sum, v) => sum + v.cvss_score, 0) / vectors.length : 0,
    highest_cvss: vectors.length > 0 ? Math.max(...vectors.map(v => v.cvss_score)) : 0
  };
}