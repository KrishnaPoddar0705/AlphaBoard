"""
Conversation State Management.
Tracks multi-step conversations for interactive flows.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ConversationFlow(Enum):
    """Enum for conversation flow types."""
    NONE = "none"
    ADD_RECOMMENDATION = "add_recommendation"
    ADD_WATCHLIST = "add_watchlist"
    SET_ALERT = "set_alert"


@dataclass
class ConversationContext:
    """Context for a multi-step conversation."""
    flow: ConversationFlow = ConversationFlow.NONE
    step: int = 0
    data: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def is_expired(self, timeout_minutes: int = 10) -> bool:
        """Check if conversation has expired."""
        return datetime.utcnow() - self.created_at > timedelta(minutes=timeout_minutes)
    
    def reset(self):
        """Reset conversation state."""
        self.flow = ConversationFlow.NONE
        self.step = 0
        self.data = {}
        self.created_at = datetime.utcnow()


class ConversationStateManager:
    """
    Manages conversation state for users.
    Uses in-memory storage (suitable for single-instance deployment).
    """
    
    def __init__(self):
        self._states: Dict[str, ConversationContext] = {}
    
    def get_context(self, user_id: str) -> ConversationContext:
        """Get or create conversation context for a user."""
        if user_id not in self._states:
            self._states[user_id] = ConversationContext()
        
        context = self._states[user_id]
        
        # Reset if expired
        if context.is_expired():
            context.reset()
        
        return context
    
    def start_flow(
        self,
        user_id: str,
        flow: ConversationFlow,
        initial_data: Optional[Dict[str, Any]] = None
    ) -> ConversationContext:
        """Start a new conversation flow."""
        context = self.get_context(user_id)
        context.flow = flow
        context.step = 1
        context.data = initial_data or {}
        context.created_at = datetime.utcnow()
        logger.info(f"Started flow {flow.value} for user {user_id}")
        return context
    
    def advance_step(self, user_id: str, data_update: Optional[Dict[str, Any]] = None) -> ConversationContext:
        """Advance to next step in flow."""
        context = self.get_context(user_id)
        context.step += 1
        if data_update:
            context.data.update(data_update)
        return context
    
    def complete_flow(self, user_id: str) -> Dict[str, Any]:
        """Complete flow and return collected data."""
        context = self.get_context(user_id)
        data = context.data.copy()
        context.reset()
        logger.info(f"Completed flow for user {user_id}")
        return data
    
    def cancel_flow(self, user_id: str):
        """Cancel current flow."""
        context = self.get_context(user_id)
        context.reset()
        logger.info(f"Cancelled flow for user {user_id}")
    
    def is_in_flow(self, user_id: str) -> bool:
        """Check if user is in an active flow."""
        context = self.get_context(user_id)
        return context.flow != ConversationFlow.NONE and not context.is_expired()
    
    def cleanup_expired(self):
        """Remove expired conversation states."""
        expired_users = [
            user_id for user_id, context in self._states.items()
            if context.is_expired(timeout_minutes=30)
        ]
        for user_id in expired_users:
            del self._states[user_id]


# Global state manager instance
state_manager = ConversationStateManager()

