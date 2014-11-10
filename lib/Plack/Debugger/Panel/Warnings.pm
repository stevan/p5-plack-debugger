package Plack::Debugger::Panel::Warnings;

# ABSTRACT: Debug panel for viewing warnings called during a request

use strict;
use warnings;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'} ||= 'Warnings';

    # NOTE:
    # This approach may be naive of me, in 
    # most other use cases the warn signal 
    # handler it is local-ized so that it 
    # will be restored once the exectution 
    # context is finished. Since we have 
    # more distinct phases of execution here
    # and not just a wrapping, we can't do 
    # that. Exactly how much I need to care
    # about this is unkwown to me, so I will
    # just leave this as is for now.
    # Patches welcome!
    # - SL

    $args{'before'} = sub {
        my ($self, $env) = @_;
        $self->stash([]);
        $SIG{'__WARN__'} = sub { 
            push @{ $self->stash } => @_;
            $self->notify('warning');
            CORE::warn @_;
        };
    };

    $args{'after'} = sub {
        my ($self, $env, $resp) = @_;
        $SIG{'__WARN__'} = 'DEFAULT';  
        $self->set_result( $self->stash ); 
    };

    $args{'metadata'} = +{ exists $args{'metadata'} ? %{ $args{'metadata'} } : () };
    $args{'metadata'}->{'highlight_on_warnings'} = 1;

    $class->SUPER::new( \%args );
}


1;

__END__

=pod

=head1 DESCRIPTION

This is a L<Plack::Debugger::Panel> subclass that will capture any 
warnings triggered during the request. 

=head2 CAVEAT

This uses the C<$SIG{__WARN__}> handler to accomplish its task in 
what is quite likely a naive way, if you care enough to fix this, 
please take a look at the source and submit a patch.

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.

=cut

