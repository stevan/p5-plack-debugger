package Plack::Debugger::Panel::AJAX;

# ABSTRACT: Debug panel for inspecting AJAX requests

use strict;
use warnings;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'AJAX Requests';
    $args{'formatter'} ||= 'subrequest_formatter';

    $args{'before'} = sub {
        my ($self, $env) = @_;
        # if it is a subrequest already,
        # then we can just disable it
        $self->disable if $self->is_subrequest( $env );
    };

    $args{'metadata'} = +{ exists $args{'metadata'} ? %{ $args{'metadata'} } : () };
    $args{'metadata'}->{'track_subrequests'}     = 1;
    $args{'metadata'}->{'highlight_on_warnings'} = 1;
    $args{'metadata'}->{'highlight_on_errors'}   = 1;

    $class->SUPER::new( \%args );
}

1;

__END__

=pod

=head1 DESCRIPTION

This is a L<Plack::Debugger::Panel> subclass that basically just 
informs the debugging UI that it should start tracking AJAX subrequests. 

=head1 IMPORTANT NOTE

This module will automatically disable itself for subrequests, this 
is simply because we do not understand the concept of a sub-sub-request.

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.

=cut