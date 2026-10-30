ALTER TABLE research.reviews DROP CONSTRAINT reviews_decision_check;
ALTER TABLE research.reviews ADD CONSTRAINT reviews_decision_check
 CHECK(decision IN ('approved','rejected','cancelled','retry','confirmed','inconclusive','edited'));
