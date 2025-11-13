import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import config from '../config';
import { CreditCheck, CreditDecision, CreditCheckType, CreditCheckRequest, CreditCheckResponse } from '../types';
import userService from './userService';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

interface CreditRules {
  minCreditScore: number;
  maxCreditScore: number;
  minApprovalScore: number;
  baseApprovalAmount: number;
  maxSingleTransaction: number;
  creditLimitTiers: {
    score: number;
    limit: number;
  }[];
}

export class CreditService {
  private rules: CreditRules = {
    minCreditScore: config.credit.minScore,
    maxCreditScore: config.credit.maxScore,
    minApprovalScore: 620,
    baseApprovalAmount: 1000,
    maxSingleTransaction: 5000,
    creditLimitTiers: [
      { score: 750, limit: 5000 },
      { score: 700, limit: 3000 },
      { score: 650, limit: 2000 },
      { score: 620, limit: 1000 },
    ],
  };

  /**
   * Perform credit check for a user
   * In MVP, this uses a simplified rule-based system
   * In production, this would integrate with credit bureaus
   */
  async performCreditCheck(request: CreditCheckRequest): Promise<CreditCheckResponse> {
    logger.info('Performing credit check', { userId: request.user_id, amount: request.requested_amount });

    // Get user information
    const user = await userService.findById(request.user_id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if user has existing credit limit
    if (user.credit_limit > 0) {
      return this.checkExistingCredit(user, request.requested_amount);
    }

    // First-time credit check - simulate credit score
    const creditScore = this.simulateCreditScore(user);
    const riskScore = this.calculateRiskScore(user, creditScore);
    const fraudScore = this.calculateFraudScore(user);

    // Make credit decision
    const decision = this.makeDecision(creditScore, riskScore, fraudScore, request.requested_amount);

    // Calculate approved amount and credit limit
    let approvedAmount: number | undefined;
    let creditLimit: number | undefined;

    if (decision === CreditDecision.APPROVED) {
      creditLimit = this.calculateCreditLimit(creditScore);
      approvedAmount = Math.min(request.requested_amount, creditLimit);
    }

    // Store credit check record
    await this.saveCreditCheck({
      id: uuidv4(),
      user_id: request.user_id,
      order_id: request.order_id,
      check_type: CreditCheckType.SOFT,
      bureau: 'SIMULATED',
      credit_score: creditScore,
      decision,
      decline_reason: decision === CreditDecision.DECLINED ? this.getDeclineReason(creditScore, riskScore) : undefined,
      approved_amount: approvedAmount,
      risk_score: riskScore,
      fraud_score: fraudScore,
      credit_limit: creditLimit,
      interest_rate: 0, // Pay in 4 is interest-free
      created_at: new Date(),
    });

    // Update user credit limit if approved
    if (decision === CreditDecision.APPROVED && creditLimit) {
      await userService.updateCreditLimit(request.user_id, creditLimit);
    }

    return {
      decision,
      approved_amount: approvedAmount,
      credit_limit: creditLimit,
      decline_reason: decision === CreditDecision.DECLINED ? this.getDeclineReason(creditScore, riskScore) : undefined,
      credit_score: creditScore,
      risk_score: riskScore,
    };
  }

  /**
   * Check if user has sufficient credit for a new purchase
   */
  private checkExistingCredit(user: any, requestedAmount: number): CreditCheckResponse {
    if (user.available_credit >= requestedAmount) {
      return {
        decision: CreditDecision.APPROVED,
        approved_amount: requestedAmount,
        credit_limit: user.credit_limit,
      };
    } else {
      return {
        decision: CreditDecision.DECLINED,
        decline_reason: 'Insufficient available credit',
        credit_limit: user.credit_limit,
      };
    }
  }

  /**
   * Simulate credit score based on user data
   * In production, this would call a credit bureau API
   */
  private simulateCreditScore(user: any): number {
    // Simple simulation based on user data completeness
    let score = 650; // Base score

    // Has complete address
    if (user.address_line1 && user.city && user.state && user.zip_code) {
      score += 30;
    }

    // Has phone number
    if (user.phone) {
      score += 20;
    }

    // Has SSN (partial)
    if (user.ssn_last_4) {
      score += 30;
    }

    // Add some randomness (+/- 50 points)
    score += Math.floor(Math.random() * 100) - 50;

    // Ensure within valid range
    return Math.max(this.rules.minCreditScore, Math.min(score, this.rules.maxCreditScore));
  }

  /**
   * Calculate risk score (0-100, higher is riskier)
   */
  private calculateRiskScore(user: any, creditScore: number): number {
    // Convert credit score to risk score (inverse relationship)
    const baseRisk = ((this.rules.maxCreditScore - creditScore) /
                     (this.rules.maxCreditScore - this.rules.minCreditScore)) * 100;

    // Adjust for KYC status
    let riskAdjustment = 0;
    if (user.kyc_status === 'PENDING') {
      riskAdjustment = 20;
    } else if (user.kyc_status === 'REJECTED') {
      riskAdjustment = 50;
    }

    return Math.min(100, baseRisk + riskAdjustment);
  }

  /**
   * Calculate fraud score (0-100, higher is more suspicious)
   */
  private calculateFraudScore(user: any): number {
    let fraudScore = 0;

    // New account (less than 1 hour old) is slightly suspicious
    const accountAge = Date.now() - new Date(user.created_at).getTime();
    const oneHour = 60 * 60 * 1000;
    if (accountAge < oneHour) {
      fraudScore += 10;
    }

    // Missing key information
    if (!user.phone) fraudScore += 5;
    if (!user.address_line1) fraudScore += 10;

    // In production, would check against fraud databases, device fingerprinting, etc.

    return Math.min(100, fraudScore);
  }

  /**
   * Make credit decision based on scores
   */
  private makeDecision(
    creditScore: number,
    riskScore: number,
    fraudScore: number,
    requestedAmount: number
  ): CreditDecision {
    // Decline if credit score too low
    if (creditScore < this.rules.minApprovalScore) {
      return CreditDecision.DECLINED;
    }

    // Decline if risk score too high
    if (riskScore > 70) {
      return CreditDecision.DECLINED;
    }

    // Manual review if fraud score too high
    if (fraudScore > 50) {
      return CreditDecision.MANUAL_REVIEW;
    }

    // Decline if requested amount exceeds limits
    if (requestedAmount > this.rules.maxSingleTransaction) {
      return CreditDecision.DECLINED;
    }

    return CreditDecision.APPROVED;
  }

  /**
   * Calculate credit limit based on credit score
   */
  private calculateCreditLimit(creditScore: number): number {
    for (const tier of this.rules.creditLimitTiers) {
      if (creditScore >= tier.score) {
        return tier.limit;
      }
    }
    return 0;
  }

  /**
   * Get human-readable decline reason
   */
  private getDeclineReason(creditScore: number, riskScore: number): string {
    if (creditScore < this.rules.minApprovalScore) {
      return 'Unable to approve credit at this time based on credit assessment';
    }
    if (riskScore > 70) {
      return 'Unable to approve credit due to risk factors';
    }
    return 'Unable to approve credit at this time';
  }

  /**
   * Save credit check to database
   */
  private async saveCreditCheck(creditCheck: CreditCheck): Promise<void> {
    const query = `
      INSERT INTO credit_checks (
        id, user_id, order_id, check_type, bureau, credit_score,
        decision, decline_reason, approved_amount, risk_score,
        fraud_score, credit_limit, interest_rate, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;

    const values = [
      creditCheck.id,
      creditCheck.user_id,
      creditCheck.order_id || null,
      creditCheck.check_type,
      creditCheck.bureau || null,
      creditCheck.credit_score || null,
      creditCheck.decision,
      creditCheck.decline_reason || null,
      creditCheck.approved_amount || null,
      creditCheck.risk_score || null,
      creditCheck.fraud_score || null,
      creditCheck.credit_limit || null,
      creditCheck.interest_rate || null,
      creditCheck.created_at,
    ];

    await db.query(query, values);
  }

  /**
   * Get credit check history for a user
   */
  async getCreditHistory(userId: string, limit: number = 10): Promise<CreditCheck[]> {
    const query = `
      SELECT *
      FROM credit_checks
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }
}

export default new CreditService();
