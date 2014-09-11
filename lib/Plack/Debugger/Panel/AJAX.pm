package Plack::Debugger::Panel::AJAX;

use strict;
use warnings;

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

    my $self = $class->SUPER::new( \%args );
    $self->add_metadata( track_subrequests => 1 );
    $self;
}

1;

__END__